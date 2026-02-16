import { listModels } from "@/utils/ai/openai-compatible"

const models = await listModels()
console.log(models.join("\n"))
