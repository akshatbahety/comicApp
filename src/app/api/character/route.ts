import { generateCharacter } from "@/lib/ai/fal";
import { badRequest, falErrorResponse, parseImageRequest, readJson, requireUser } from "@/lib/ai/request";

/** Seedream can take 15–25s, more on a fal cold start. */
export const maxDuration = 120;

/** POST /api/character — draws the reference character a comic's panels are based on. */
export async function POST(request: Request) {
  const denied = await requireUser();
  if (denied) return denied;
  const body = await readJson(request);
  if (!body) return badRequest("Invalid JSON body");
  const parsed = parseImageRequest(body);
  if (typeof parsed === "string") return badRequest(parsed);

  try {
    return Response.json(await generateCharacter(parsed));
  } catch (err) {
    return falErrorResponse(err, "Character generation");
  }
}
