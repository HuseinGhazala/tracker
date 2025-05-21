import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
// import {openai} from '@genkit-ai/openai'; // OpenAI plugin import removed as package not found

export const ai = genkit({
  promptDir: './prompts',
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
    }),
    // openai({ // OpenAI plugin configuration removed
    //   apiKey: process.env.OPENAI_API_KEY,
    // }),
  ],
  // Default model can remain or be changed.
  // We will specify the model in the financialAnalysisPrompt directly.
  model: 'googleai/gemini-2.0-flash', // It's good practice to keep a default model
});
