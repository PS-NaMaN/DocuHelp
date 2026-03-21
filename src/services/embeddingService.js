import { env, pipeline } from '@huggingface/transformers'

const EMBEDDING_MODEL_NAME = 'Xenova/all-MiniLM-L6-v2'
let featureExtractionPipelinePromise

configureEmbeddingRuntime()

/**
 * Generate one embedding vector per chunk using the in-browser feature-extraction pipeline.
 *
 * @param {Array<{ text: string }>} textChunks - Chunks that should be embedded.
 * @param {(progress: { current: number, total: number }) => void} [reportProgress] - Optional callback for per-chunk progress.
 * @returns {Promise<Float32Array[]>} Embedding vectors aligned with the input chunk order.
 */
export async function generateEmbeddings(textChunks, reportProgress) {
  if (!textChunks.length) {
    return []
  }

  const featureExtractor = await getFeatureExtractor()
  const embeddingVectors = []

  for (let chunkIndex = 0; chunkIndex < textChunks.length; chunkIndex += 1) {
    reportProgress?.({
      current: chunkIndex,
      total: textChunks.length,
    })

    const embeddingOutput = await featureExtractor(textChunks[chunkIndex].text, {
      pooling: 'mean',
      normalize: true,
    })

    embeddingVectors.push(Float32Array.from(embeddingOutput.data))
  }

  reportProgress?.({
    current: textChunks.length,
    total: textChunks.length,
  })

  return embeddingVectors
}

/**
 * Probe the embedding dimensionality exposed by the configured model.
 *
 * @returns {Promise<number>} Length of a single embedding vector.
 */
export async function getEmbeddingDimensions() {
  const featureExtractor = await getFeatureExtractor()
  const embeddingOutput = await featureExtractor('dimension probe', {
    pooling: 'mean',
    normalize: true,
  })

  return embeddingOutput.data.length
}

/**
 * Configure the shared browser-side runtime once at module load time.
 *
 * @returns {void}
 */
function configureEmbeddingRuntime() {
  env.allowLocalModels = false
  env.useBrowserCache = true
  env.backends.onnx.wasm.numThreads = 1
}

/**
 * Lazily create and cache the feature extraction pipeline.
 *
 * @returns {Promise<Function>} The cached transformers.js feature extraction pipeline.
 */
async function getFeatureExtractor() {
  if (!featureExtractionPipelinePromise) {
    featureExtractionPipelinePromise = pipeline('feature-extraction', EMBEDDING_MODEL_NAME, {
      dtype: 'q8',
      device: 'wasm',
    })
  }

  return featureExtractionPipelinePromise
}
