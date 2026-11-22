import { generatePanel, isAllowedReferenceUrl } from "@/lib/ai/fal";
import { badRequest, falErrorResponse, parseImageRequest, readJson, requireUser } from "@/lib/ai/request";
import { MAX_PANELS } from "@/lib/presets";

/** Seedream edit takes ~35s typically, up to ~60s. */
export const maxDuration = 120;

/** POST /api/panels — draws one comic panel from the character reference image. */
export async function POST(request: Request) {
  const denied = await requireUser();
  if (denied) return denied;
  const body = await readJson(request);
  if (!body) return badRequest("Invalid JSON body");
  const parsed = parseImageRequest(body);
  if (typeof parsed === "string") return badRequest(parsed);

  const panelIndex = Number(body.panelIndex);
  if (!Number.isInteger(panelIndex) || panelIndex < 0 || panelIndex >= MAX_PANELS)
    return badRequest(`panelIndex must be 0–${MAX_PANELS - 1}`);

  if (!isAllowedReferenceUrl(body.referenceUrl)) return badRequest("referenceUrl must be a fal.media or Panelforge storage image URL");

  try {
    return Response.json(await generatePanel({ ...parsed, referenceUrl: body.referenceUrl }));
  } catch (err) {
    return falErrorResponse(err, "Panel generation");
  }
}
