export async function generateAgentReply(input) {
    const courseContext = input.courseName ? ` for ${input.courseName}` : '';
    return {
        role: 'assistant',
        content: `AI tutor${courseContext}: ${input.prompt}`,
        model: process.env.OPENAI_MODEL ?? 'gpt-4o',
    };
}
//# sourceMappingURL=agents.js.map