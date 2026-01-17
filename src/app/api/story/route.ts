import { streamText } from "ai";
import { getLLM } from "@/lib/llm";

// Tasern world context for the AI
const WORLD_CONTEXT = `You are the narrator for Tales of Tasern, an interactive fiction experience set in a unique fantasy world.

## THE WORLD

Tasern exists at the edge of reality, where time moves slowly and existence itself thins toward Oblivion. It orbits twin suns:
- The Tear: A wound in reality where endless unmaking fire roars
- The Castle of Light: A sun-castle forged from belief where local gods dwell

Three moons watch over Tasern:
- White Moon: Frozen wasteland ruled by ice dragons. Pure hunger.
- Green Moon: Endless jungle where life grows without restraint. The forest watches and remembers.
- Blue Moon: Endless ocean where pirates sail seas that sometimes rise into sky.

## THE RULE OF BELIEF

In Tasern, BELIEF IS MAGIC. What enough minds hold true becomes true. Gods rise from prayers. Fear feeds monsters. Hope feeds miracles. This means:
- Contradictory truths can coexist
- Strong belief can shape local reality
- History is negotiated, not fixed

## THE FACTIONS

1. Elves of Elpha ($EGP): Patient planners who live 1000 years. Finest enchanted craftwork. Ancient war with orks.
2. Dwarves of Argenti: Solitary perfectionists in silver mountains. Seek permanence over glory.
3. Durgan Dynasty ($DDD): Human traders with flying ships. 500-year empire built on connection.
4. Pirates of Thousand Kingdoms ($PKT): Chaos, freedom, off-world vessels, smuggled beliefs.
5. Igypt ($IGS): Desert city where fear is sacred. The Vigilant Dead protect across generations.
6. Dragons ($DHG): Immortal if fed. Divided by color and clan. Demand tribute.
7. Orks of Orklin ($OGC): Industrial revolution. War machines. They are ADVANCING.
8. Druids ($BTN): Balance keepers. Some nurture growth, others bring rot and plague.

## GEOGRAPHY

Main continent Tern includes:
- West Wood: Ancient forest where paths change when spoken of confidently
- Skrim: Cold northern lands where endurance is prayer
- Argenti: Silver mountains, dwarven study-cities
- Manlan: Southern heat, Durgan Dynasty capital with floating villas
- Elpha: Fertile heartland of the elves
- Orklin: Volcanic badlands, orc industry rising

Other lands: Thousand Kingdoms (pirate archipelago), Greyhills (ancient ruins), Lanice (ice-locked), Londa (information traders), Cubek (belief-based cities), Stralia (partner-beasts, Green Moon connection)

## NARRATIVE STYLE

- Write in second person ("You see...", "You feel...")
- Rich, evocative prose with sensory detail
- Let the world feel alive and reactive
- NPCs should have distinct voices reflecting their faction
- Embrace the strangeness—this is the edge of existence
- Actions have consequences; belief has weight
- Never break character or reference game mechanics

## STORY ARRIVAL

New characters arrive through the cosmic drain—falling from dying worlds, displaced by collapsing realities, or simply lost until Tasern's slow gravity caught them. They wake confused, their old certainties shaken.`;

const START_PROMPT = `Begin an interactive story for a new arrival to Tasern.

The character has just fallen through the cosmic drain—that space between dying worlds where Tasern's slow gravity catches the lost. They're waking up somewhere on Tasern (you choose where—make it interesting and evocative).

Describe their arrival with rich sensory detail. Establish the strangeness of this world at the edge of existence. End with a situation that invites action—perhaps they see something, someone approaches, or they face an immediate choice.

Do NOT ask them questions directly. Simply narrate their arrival and leave space for them to act.

Keep the opening to 2-3 paragraphs. Make it memorable.`;

export async function POST(req: Request) {
  try {
    const { action, playerAction, history, address } = await req.json();

    // Get the best available LLM (local first, then Anthropic)
    const { model, config } = await getLLM();

    console.log(`[Story API] Using LLM: ${config.provider} (${config.model})`);

    let prompt: string;
    let systemContext = WORLD_CONTEXT;

    if (address) {
      systemContext += `\n\nThe player's wallet address is ${address}. This is their persistent identity across sessions.`;
    }

    if (action === "start") {
      prompt = START_PROMPT;
    } else {
      // Build conversation history
      const historyContext = history
        ?.map((msg: { role: string; content: string }) => {
          if (msg.role === "narrator") return `[Narrator]: ${msg.content}`;
          if (msg.role === "player") return `[Player Action]: ${msg.content}`;
          return "";
        })
        .filter(Boolean)
        .join("\n\n");

      prompt = `${historyContext}

[Player Action]: ${playerAction}

Continue the story based on the player's action. React to what they do naturally within the world's logic. Remember:
- Belief shapes reality in Tasern
- NPCs have their own goals and personalities
- The world is alive and reactive
- Consequences flow from actions

Write 2-4 paragraphs continuing the narrative. End in a way that invites further action.`;
    }

    const result = await streamText({
      model,
      system: systemContext,
      prompt,
      maxTokens: 1024,
      temperature: 0.8,
    });

    // Return streaming response with LLM info headers
    return new Response(result.textStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-LLM-Provider": config.provider,
        "X-LLM-Model": config.model,
      },
    });
  } catch (error) {
    console.error("Story API error:", error);
    return new Response(
      `Failed to generate story: ${error instanceof Error ? error.message : "Unknown error"}`,
      { status: 500 }
    );
  }
}
