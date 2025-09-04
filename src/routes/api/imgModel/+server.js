// Enhanced version of your /api/imgModel endpoint with better debugging
const jobs = new Map();

export async function POST({ request }) {
    const { prompt, imgHeight, imgWidth } = await request.json();
    const jobId = crypto.randomUUID();

    console.log(`Starting job ${jobId} with prompt:`, prompt);

    // mark job as processing
    jobs.set(jobId, { status: "processing", image: null, error: null });

    // fire async task (don't await!)
    (async () => {
        try {
            console.log(`Job ${jobId}: Sending request to Gradio...`);
            
            const url = 'https://b2b025d0d273ad80ce.gradio.live/sdapi/v1/txt2img';
            const params = {
                prompt,
                steps: 35,
                guidance_scale: 6,
                sampler_index: 'DPM++ 2M Karras',
                negative_prompt: "extra fingers, missing fingers, poorly rendered hands, mutation, deformed limbs, watermark",
                clip_skip: 2,
                height: imgHeight,
                width: imgWidth,
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });

            console.log(`Job ${jobId}: Gradio response status:`, response.status);

            if (response.ok) {
                const data = await response.json();
                console.log(`Job ${jobId}: Success! Image generated, length:`, data.images?.[0]?.length || 'No image data');
                
                if (data.images && data.images[0]) {
                    jobs.set(jobId, { status: "done", image: data.images[0], error: null });
                } else {
                    console.log(`Job ${jobId}: No image in response:`, data);
                    jobs.set(jobId, { status: "error", image: null, error: "No image data in response" });
                }
            } else {
                const errorText = await response.text();
                console.log(`Job ${jobId}: Gradio error response:`, errorText);
                jobs.set(jobId, { status: "error", image: null, error: `HTTP ${response.status}: ${errorText}` });
            }
        } catch (e) {
            console.error(`Job ${jobId}: Exception occurred:`, e);
            jobs.set(jobId, { status: "error", image: null, error: e.message });
        }
    })();

    return new Response(JSON.stringify({ jobId, status: "processing" }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

// status endpoint
export async function GET({ url }) {
    const jobId = url.searchParams.get("jobId");
    const job = jobs.get(jobId);

    if (!job) {
        console.log(`Job ${jobId}: Not found`);
        return new Response(JSON.stringify({ error: "Job not found" }), { status: 404 });
    }

    console.log(`Job ${jobId}: Status check - ${job.status}`);
    
    // Include error details in response for debugging
    const response = {
        status: job.status,
        image: job.image,
        error: job.error // Add error details
    };

    return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' }
    });
}