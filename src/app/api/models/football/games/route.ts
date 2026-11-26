import { forwardModelRequest } from "@/lib/model-api";

export async function GET(request: Request) {
  return forwardModelRequest(request, "Football", "games");
}
