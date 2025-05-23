import {
  SolanaAgentKit,
  createLangchainTools,
  KeypairWallet,
} from "solana-agent-kit";
import NFTPlugin from "@solana-agent-kit/plugin-nft";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import * as dotenv from "dotenv";
import * as readline from "readline";

dotenv.config();

async function initializeAgent() {
  const llm = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.7,
  });

  // プライベートキーからSolana上のウォレットを作成
  const keyPair = Keypair.fromSecretKey(
    bs58.decode(process.env.SOLANA_PRIVATE_KEY!)
  );
  const wallet = new KeypairWallet(keyPair, process.env.RPC_URL!);

  // SolanaAgentKitのインスタンスを作成
  // v1と異なりuseメソッドで必要なプラグインを追加する
  const agent = new SolanaAgentKit(wallet, process.env.RPC_URL!, {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  }).use(NFTPlugin);

  // エージェントが呼び出せるツールセット
  const tools = createLangchainTools(agent, agent.actions);

  const memory = new MemorySaver();

  return createReactAgent({
    llm,
    tools,
    checkpointSaver: memory,
  });
}

async function runInteractiveChat() {
  const agent = await initializeAgent();

  const config = { configurable: { thread_id: "Solana Agent Kit!" } };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  setTimeout(() => {
    console.clear();
    console.log("Chat with Solana Agent Kit (type 'exit' to quit)");
    console.log("--------------------------------------------");
    askQuestion();
  }, 100);

  const askQuestion = () => {
    rl.question("You: ", async (input) => {
      if (input.toLowerCase() === "exit") {
        rl.close();
        return;
      }

      const stream = await agent.stream(
        {
          messages: [new HumanMessage(input)],
        },
        config
      );

      process.stdout.write("Agent: ");
      for await (const chunk of stream) {
        if ("agent" in chunk) {
          process.stdout.write(chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
          process.stdout.write(chunk.tools.messages[0].content);
        }
      }

      console.log("\n--------------------------------------------");
      askQuestion();
    });
  };
}

runInteractiveChat().catch(console.error);
