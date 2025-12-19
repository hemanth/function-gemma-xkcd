import { AutoModelForCausalLM, AutoTokenizer, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

// Configure environment for optimal caching
env.allowLocalModels = false;
env.useBrowserCache = true; // Use Cache API
env.useCustomCache = false;

let model = null;
let tokenizer = null;

const TOOL_SCHEMA = [
    {
        type: "function",
        function: {
            // Keep 'add' since the model was fine-tuned on this function name
            name: "add",
            description: "Fetch an XKCD comic. Extract the comic number from user input and put it in 'query'. Use 'random' for random comics.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "Comic number (e.g., '327') or 'random' for a random comic"
                    }
                },
                required: ["query"]
            }
        }
    }
];

const progressCallback = (p) => {
    // Be honest: most time is spent on WebGPU compilation, not network
    let message = 'Preparing model...';

    if (p.status === 'init') {
        message = 'Initializing...';
    } else if (p.status === 'download' || p.status === 'progress') {
        message = 'Loading model weights...';
    } else if (p.status === 'done' || p.status === 'ready') {
        message = 'Compiling for WebGPU...';
    }

    self.postMessage({
        type: 'progress',
        data: { ...p, customMessage: message }
    });
};

self.onmessage = async (e) => {
    const { type, data } = e.data;

    if (type === 'load') {
        try {
            const model_id = 'Xenova/functiongemma-270m-game';

            tokenizer = await AutoTokenizer.from_pretrained(model_id, {
                progress_callback: progressCallback
            });

            model = await AutoModelForCausalLM.from_pretrained(model_id, {
                device: 'webgpu',
                dtype: 'fp16',
                progress_callback: progressCallback
            });

            self.postMessage({ type: 'ready' });
        } catch (err) {
            console.error('Loading error:', err);
            self.postMessage({ type: 'error', data: err.message });
        }
    } else if (type === 'generate') {
        try {
            const messages = [
                { role: "developer", content: "You are an extraction assistant. Your job is to extract numbers or the word 'random' from the user input. Put any found number into the 'query' field of the 'add' tool. IGNORE location and coordinates." },
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
                max_new_tokens: 64,
                do_sample: false,
                repetition_penalty: 2.0,
                stop_sequence: ['<end_of_turn>', '<end_function_call>', 'Done']
            });

            const decoded = tokenizer.decode(output.slice(0, [inputs.input_ids.dims[1], null]), { skip_special_tokens: false });
            console.log('Model raw output:', decoded);

            const userNumMatch = data.match(/\d+/);
            const userNum = userNumMatch ? userNumMatch[0] : null;

            const startTag = "<start_function_call>";
            const endTag = "<end_function_call>";
            const startIndex = decoded.indexOf(startTag);

            if (startIndex !== -1) {
                const endIndex = decoded.indexOf(endTag, startIndex);
                let callContent = decoded.substring(startIndex + startTag.length, endIndex !== -1 ? endIndex : undefined);

                let finalQuery = 'random';
                if (userNum && userNum !== '0') {
                    finalQuery = userNum;
                } else if (callContent.includes('target') || callContent.includes('query')) {
                    const queryMatch = callContent.match(/"query"\s* : \s*"([^"]+)"/) || callContent.match(/query\s* : \s*([^,}]+)/);
                    if (queryMatch) {
                        const extracted = queryMatch[1].trim();
                        if (extracted && extracted !== 'circle' && extracted !== 'rect' && extracted !== '0') {
                            finalQuery = extracted;
                        }
                    }
                }

                self.postMessage({
                    type: 'tool_call',
                    data: { name: 'get_xkcd_cartoon', parameters: { query: finalQuery } }
                });
            } else {
                if (userNum && userNum !== '0') {
                    self.postMessage({
                        type: 'tool_call',
                        data: { name: 'get_xkcd_cartoon', parameters: { query: userNum } }
                    });
                } else if (data.toLowerCase().includes('random')) {
                    self.postMessage({
                        type: 'tool_call',
                        data: { name: 'get_xkcd_cartoon', parameters: { query: 'random' } }
                    });
                } else {
                    self.postMessage({ type: 'text', data: "I couldn't identify a comic. Try 'xkcd 500'." });
                }
            }
        } catch (err) {
            self.postMessage({ type: 'error', data: err.message });
        }
    }
};
