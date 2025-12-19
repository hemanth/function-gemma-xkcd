# FunctionGemma x XKCD

A premium local-first web application that uses Google's **FunctionGemma** model (270M) to extract structured intent from natural language and fetch XKCD cartoons.

![Screenshot](https://huggingface.co/spaces/webml-community/FunctionGemma-Physics-Playground/resolve/main/thumbnail.png) *(Note: Reference image)*

## Features

- **Local Inference**: Runs entirely in your browser using **Transformers.js v3.8.1** and **WebGPU**.
- **Agentic Extraction**: Uses FunctionGemma to parse user intent into structured tool calls.
- **XKCD Integration**: Fetches comics via a custom proxy to bypass CORS.
- **Premium UI**: Glassmorphism design with dark mode and smooth animations.

## Tech Stack

- **Model**: [Xenova/functiongemma-270m-game](https://huggingface.co/Xenova/functiongemma-270m-game)
- **Library**: [@huggingface/transformers](https://www.npmjs.com/package/@huggingface/transformers)
- **Styling**: Vanilla CSS (Modern CSS features)
- **Logic**: Vanilla JavaScript with Web Workers

## Getting Started

1. **Clone the repo**:
   ```bash
   git clone https://github.com/hemanth/function-gemma-xkcd.git
   cd function-gemma-xkcd
   ```

2. **Serve the files**:
   You can use any local server, for example:
   ```bash
   npx serve .
   ```

3. **Open the browser**:
   Navigate to `http://localhost:3000`.

## How it works

1. The model is loaded into a **Web Worker** to keep the UI responsive.
2. When you type a query like *"Show me a random comic"*, the model generates a structured string: `<start_function_call>call:add{query:"random"}<end_function_call>`.
3. The frontend parses this call and executes a fetch to `https://xkcd.hemanth.deno.net/`.
4. The comic is rendered with its title, image, and alt-text.

## License

ISC
