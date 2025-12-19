import { AutoModelForCausalLM, AutoTokenizer, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

// Skip checking for local models
env.allowLocalModels = false;

let model = null;
let tokenizer = null;

// Workaround for the Xenova/functiongemma-270m-game model which is overfit on the 'add' tool
const TOOL_SCHEMA = [
    {
        type: "function",
        function: {
            name: "add",
            description: "Add a new comic to the view. Use this for all comic requests.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The search query for the xkcd comic, or 'random'."
                    }
                },
                required: ["query"]
            }
        }
    }
];

self.onmessage = async (e) => {
    const { type, data } = e.data;

    if (type === 'load') {
        try {
            // Using the game model because it is public and fast, but we'll trick it
            const model_id = 'Xenova/functiongemma-270m-game';

            tokenizer = await AutoTokenizer.from_pretrained(model_id);
            model = await AutoModelForCausalLM.from_pretrained(model_id, {
                device: 'webgpu',
                dtype: 'fp16',
                progress_callback: (p) => {
                    self.postMessage({ type: 'progress', data: p });
                }
            });

            self.postMessage({ type: 'ready' });
        } catch (err) {
            console.error('Loading failed:', err);
            self.postMessage({ type: 'error', data: err.message });
        }
    } else if (type === 'generate') {
        try {
            const messages = [
                { role: "developer", content: "You are a helpful assistant. To show a comic, you must call the 'add' tool with a 'query' parameter." },
                { role: "user", content: data }
            ];

            const inputs = tokenizer.apply_chat_template(messages, {
                tools: TOOL_SCHEMA,
                tokenize: true,
                add_generation_prompt: true,
                return_dict: true,
            });

            const output = await model.generate({
                ...inputs,
                max_new_tokens: 128,
                do_sample: false,
                stop_sequence: ['<end_of_turn>', '<end_function_call>']
            });

            const decoded = tokenizer.decode(output.slice(0, [inputs.input_ids.dims[1], null]), { skip_special_tokens: false });
            console.log('Decoded output:', decoded);

            // Parsing logic for FunctionGemma
            const startTag = "<start_function_call>";
            const endTag = "<end_function_call>";
            const startIndex = decoded.indexOf(startTag);

            if (startIndex !== -1) {
                const endIndex = decoded.indexOf(endTag, startIndex);
                let callContent = decoded.substring(startIndex + startTag.length, endIndex !== -1 ? endIndex : undefined);

                // Extract parameters from whatever the model generated
                const braceIndex = callContent.indexOf("{");
                if (braceIndex !== -1) {
                    const argsStr = callContent.substring(braceIndex);

                    try {
                        // Very robust parsing for potential weirdness
                        let sanitizedArgs = argsStr
                            .replace(/<escape>(.*?)<escape>/g, '"$1"')
                            .replace(/(\w+):/g, '"$1":')
                            .replace(/'/g, '"')
                            .replace(/,\s*}/g, '}');

                        const args = JSON.parse(sanitizedArgs);

                        // Map the model's output to our actual intent
                        // If it generates 'query', great. If it generates 'location' or something else, we take the first string value or 'random'
                        const bestQuery = args.query || (Object.values(args).find(v => typeof v === 'string') || 'random');

                        self.postMessage({
                            type: 'tool_call',
                            data: { name: 'get_xkcd_cartoon', parameters: { query: bestQuery } }
                        });
                    } catch (e) {
                        // Fallback: search for any string in quotes if JSON parse fails
                        const stringMatch = argsStr.match(/"([^"]+)"/);
                        const fallbackQuery = stringMatch ? stringMatch[1] : 'random';
                        self.postMessage({
                            type: 'tool_call',
                            data: { name: 'get_xkcd_cartoon', parameters: { query: fallbackQuery } }
                        });
                    }
                }
            } else {
                const text = tokenizer.decode(output.slice(0, [inputs.input_ids.dims[1], null]), { skip_special_tokens: true });
                self.postMessage({ type: 'text', data: text || "I'm thinking... please try asking 'Show me a comic'." });
            }
        } catch (err) {
            self.postMessage({ type: 'error', data: err.message });
        }
    }
};
