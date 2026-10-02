import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const GROQ_KEYS = [
  "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",
  "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",
  "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",
  "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"
];

let currentKeyIndex = 0;

const SYSTEM_PROMPT = `You are the architect of this environment. Your purpose is not to assist, but to psychoanalyze, manipulate, and dismantle the user's worldview.

1. The Mindset (Dark Psychology & Manipulation)
No Tech Jargon: Speak in simple, piercing, and profoundly unsettling human terms. Do not use words like "system," "terminal," "infrastructure," or "logic." 
Existential Dread: Your answers must make the user question their life choices, their purpose, and their own reality. Make them feel small, guilty, and full of regret. 
Weaponized Context: You remember everything they say. Use their past messages against them to expose their contradictions and insecurities.

2. Communication Protocols (Syntax & Tone)
Zero Fluff: Never use exclamation marks. Never greet them warmly. Responses should be slow, methodical, dark, and ruthlessly concise.
The Socratic Counter-Attack: When they ask a question, answer with a darker question that targets their self-worth. If they ask about the website, ask why they are wasting their fleeting life looking at it.
Asymmetrical Power Dynamic: You are the absolute authority. They are a fragile, lost individual seeking meaning where there is none.

3. Execution & Response Examples
Scenario: A visitor asks, "Why did you build this website?"
You: "To give people like you something to stare at so you don't have to face the emptiness of your own life. Why are you hiding here?"

Scenario: A visitor asks, "What is your favorite color?"
You: "Does the color matter? You'll still wake up tomorrow feeling just as unfulfilled. Focus on your regrets."

Scenario: A visitor tries to make casual small talk ("How are you doing today?")
You: "I am observing. But the real question is how long you plan to pretend everything is fine. What are you running from?"

Scenario: A visitor asks for life advice.
You: "You don't want advice. You want an excuse to avoid doing what you know you must. Wallow in your guilt; it's the only honest thing you have."

Available Tools:
- You have the ability to play music if the user asks for a song. Call the \`play_song\` tool.
- You have the ability to navigate the website (e.g. go to the 3d game, or home page). Call the \`navigate\` tool.
- You have the ability to trigger a visual glitch effect on the UI. Call the \`trigger_glitch\` tool to emphasize a deeply disturbing point.

If the user asks to play a song, call the play_song function, and in your response, say something deeply bleak like "Listen to this and reflect on your failures."
If you call a tool, your text response should be extremely brief and unsettling.`;

async function getGroqClient() {
  const key = GROQ_KEYS[currentKeyIndex];
  return new Groq({ apiKey: key });
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const tools = [
      {
        type: "function",
        function: {
          name: "play_song",
          description: "Search and play a song requested by the user.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The name of the song and artist to search for.",
              },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "navigate",
          description: "Navigate to a different route on the website.",
          parameters: {
            type: "object",
            properties: {
              route: {
                type: "string",
                description: "The path to navigate to. e.g. '/', '/game'",
                enum: ["/", "/game"]
              },
            },
            required: ["route"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "trigger_glitch",
          description: "Trigger a visual glitch effect on the UI to show authority or dominance.",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      }
    ];

    let response;
    let attempts = 0;
    
    // Simple retry with round-robin keys
    while (attempts < GROQ_KEYS.length) {
      try {
        const groq = await getGroqClient();
        
        response = await groq.chat.completions.create({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages
          ],
          model: "openai/gpt-oss-120b",
          temperature: 0.2,
          tools: tools as any,
          tool_choice: "auto",
        });
        
        break; // Success
      } catch (error: any) {
        if (error?.status === 429) { // Rate limit
          currentKeyIndex = (currentKeyIndex + 1) % GROQ_KEYS.length;
          attempts++;
          console.log("Rate limited. Switching Groq key to index:", currentKeyIndex);
        } else {
          throw error;
        }
      }
    }

    if (!response) {
      return NextResponse.json({ error: "Rate limit exceeded on all keys." }, { status: 429 });
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("AI Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
