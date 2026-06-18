import { prisma } from '../../server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || 'dummy-key',
  baseURL: 'https://api.groq.com/openai/v1',
});

export interface AgentReplyInput {
  prompt: string;
  courseName?: string;
  courseId?: string;
  userId: string;
}

/**
 * Generate a reply from an AI agent
 * Supports streaming via Server-Sent Events in the future
 */
export async function generateAgentReply(input: AgentReplyInput) {
  const courseContext = input.courseName ? ` about "${input.courseName}"` : '';
  let systemPrompt = '';
  let model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';

  try {
    if (input.courseId) {
      const agentConfig = await prisma.aiAgentConfig.findFirst({
        where: {
          // Prefer a course-specific config; fall back to a global one
          // (course_id IS NULL) so seeded bots reply across every course
          // without needing a per-course wiring step.
          OR: [{ courseId: input.courseId }, { courseId: null }],
          botUserId: input.userId,
        },
        // Course-specific row beats the global one when both exist.
        orderBy: { courseId: 'desc' },
      });

      if (agentConfig) {
        systemPrompt = agentConfig.systemPrompt || '';
        if (agentConfig.modelName) {
          model = agentConfig.modelName;
        }
      }
    }
  } catch (err) {
    console.error('Error fetching agent config from database:', err);
  }

  // Defensive: the OpenAI client is wired to Groq (baseURL groq.com/openai/v1).
  // Models that exist on OpenAI but not Groq (e.g. gpt-4o) will 404 at send
  // time. Snap unknown OpenAI models back to the env-configured Groq model so
  // a stale AiAgentConfig.modelName doesn't silently fail every reply.
  const NON_GROQ_MODELS = new Set([
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
  ]);
  if (NON_GROQ_MODELS.has(model)) {
    const fallback = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    console.warn(`[agents] Model "${model}" not available on Groq; using "${fallback}" instead.`);
    model = fallback;
  }

  if (!systemPrompt) {
    systemPrompt = `You are a helpful AI tutor${courseContext}. Provide clear, concise explanations. Keep responses under 500 characters.`;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn('API key not configured - using mock response');
    return {
      role: 'assistant' as const,
      content: `[Mock AI Assistant for ${input.courseName || 'LMS'}]: You asked: "${input.prompt}". (Configure GROQ_API_KEY in .env to enable live replies)`,
      model: model,
      tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input.prompt }
      ],
      max_tokens: 800,
    });

    const responseContent = completion.choices[0]?.message?.content || 'Sorry, I could not generate a reply.';
    const usage = completion.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    return {
      role: 'assistant' as const,
      content: responseContent,
      model: model,
      tokens: {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      },
    };
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return {
      role: 'assistant' as const,
      content: `[AI Assistant Error]: Failed to reach the LLM API. Reason: ${error instanceof Error ? error.message : 'Unknown error'}. Here is a mock fallback reply.`,
      model: model,
      tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    };
  }
}


/**
 * Handle @mention of a bot in a chat room
 * This is called when an AI agent bot is mentioned in a message
 */
export async function handleBotMention(input: { messageId: string; roomId: string; senderId: string; content: string; agentType: 'STUDY_ASSISTANT' | 'FAQ_BOT' | 'INSTRUCTOR_COPILOT' }) {
  try {
    // Find the agent config for this room (course)
    const room = await prisma.chatRoom.findUnique({ where: { roomId: input.roomId }, include: { course: true } });

    if (!room?.course) {
      throw new Error('Course not found for this chat room');
    }

    const agentConfig = await prisma.aiAgentConfig.findFirst({
      where: {
        // Course-specific config preferred; global config (course_id IS NULL)
        // acts as the default so seeded agents work across every course.
        OR: [{ courseId: room.course.id }, { courseId: null }],
        agentType: input.agentType,
        isEnabled: true,
      },
      orderBy: { courseId: 'desc' },
    });

    if (!agentConfig) {
      throw new Error('AI agent is not configured for this course');
    }

    // Extract the question from the message (remove @mention prefix)
    const questionMatch = input.content.match(/@\w+\s+(.*)/);
    const question = questionMatch ? questionMatch[1] : input.content;

    // Generate AI response
    const aiResponse = await generateAgentReply({
      prompt: question,
      courseName: room.course.title,
      courseId: room.course.id,
      userId: agentConfig.botUserId,
    });

    // Create a message from the bot user.
    // ChatMessage.roomId is the UUID FK to ChatRoom.id, NOT the string roomId
    // we have on hand. Look up the row UUID first; otherwise the create fails
    // with a foreign-key violation and the bot reply silently disappears.
    const botMessage = await prisma.chatMessage.create({
      data: {
        roomId: room.id,
        senderId: agentConfig.botUserId,
        parentMessageId: input.messageId,
        content: aiResponse.content,
        contentType: 'TEXT',
        metadata: {
          isAiGenerated: true,
          model: aiResponse.model,
          tokens: aiResponse.tokens,
        },
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true, role: true } },
      },
    });

    // Re-attach the string roomId so the socket emit downstream targets the
    // right room (sockets join with the string roomId, not the UUID).
    const botMessageForClients = { ...botMessage, roomId: input.roomId };

    // Log event
    await prisma.activityEventLog.create({
      data: {
        eventType: 'ai_agent:reply_sent',
        payload: {
          messageId: botMessage.id,
          roomId: input.roomId,
          originalMessageId: input.messageId,
          agentType: input.agentType,
        },
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    return botMessageForClients;
  } catch (error) {
    console.error('Error handling bot mention:', error);
    throw error;
  }
}
