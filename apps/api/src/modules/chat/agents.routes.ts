import { Router } from 'express';
import OpenAI from 'openai';
import { requireAuth } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';
import { z } from 'zod';

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || 'dummy-key',
  baseURL: 'https://api.groq.com/openai/v1',
});

const agentMessageSchema = z.object({
  prompt: z.string().min(1),
  courseName: z.string().optional(),
  courseId: z.string().optional(),
});

async function generateAgentReply(input: {
  prompt: string;
  courseName?: string;
  courseId?: string;
  userId: string;
}) {
  const courseContext = input.courseName ? ` about "${input.courseName}"` : '';
  let systemPrompt = '';
  const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';

  // Try to load a per-course agent config from the database
  try {
    if (input.courseId) {
      const agentConfig = await prisma.aiAgentConfig.findFirst({
        where: { courseId: input.courseId },
      });
      if (agentConfig) {
        systemPrompt = agentConfig.systemPrompt || '';
      }
    }
  } catch {
    // Database may not have the table — ignore
  }

  if (!systemPrompt) {
    systemPrompt = input.courseName
      ? `You are a knowledgeable AI study assistant for the course "${input.courseName}". Help students understand concepts, answer questions, provide examples, and explain topics related to this course. Be concise, accurate, and encouraging.`
      : `You are a knowledgeable AI study assistant for an online learning platform. Help students understand any topic they ask about — programming, data science, design, business, mathematics, or any other subject. Provide clear explanations with examples when helpful. Be concise, accurate, and encouraging. Adapt your response depth to the complexity of the question.`;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'dummy-key') {
    return {
      role: 'assistant',
      content: `[AI Assistant — no API key configured]: You asked: "${input.prompt}". Please set GROQ_API_KEY in .env to enable live AI replies.`,
      model,
      tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input.prompt },
      ],
      max_tokens: 800,
    });

    const responseContent =
      completion.choices[0]?.message?.content || 'Sorry, I could not generate a reply.';
    const usage = completion.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    return {
      role: 'assistant',
      content: responseContent,
      model,
      tokens: {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      },
    };
  } catch (error: any) {
    console.error('Error calling Groq API:', error?.message ?? error);
    return {
      role: 'assistant',
      content: `[AI Assistant Error]: Failed to reach the LLM API. ${error?.message ?? 'Unknown error'}`,
      model,
      tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  }
}

export const chatAgentsRoutes = Router();

// POST /api/chat/agents/message — AI Study Copilot (used by web & mobile)
chatAgentsRoutes.post('/agents/message', requireAuth, async (req, res, next) => {
  try {
    const input = agentMessageSchema.parse(req.body);
    const reply = await generateAgentReply({
      ...input,
      userId: (req as any).user.id,
    });
    res.json({ success: true, data: reply });
  } catch (error) {
    next(error);
  }
});

// POST /api/chat/agents/summarize — Summarize discussion (instructor copilot)
chatAgentsRoutes.post('/agents/summarize', requireAuth, async (req, res, next) => {
  try {
    const { messages, context } = req.body;
    const reply = await generateAgentReply({
      prompt: `Summarize the following discussion messages concisely:\n\n${
        Array.isArray(messages)
          ? messages.map((m: any) => `${m.sender}: ${m.text}`).join('\n')
          : messages || 'No messages provided'
      }`,
      courseName: context,
      userId: (req as any).user.id,
    });
    res.json({ success: true, data: reply });
  } catch (error) {
    next(error);
  }
});
