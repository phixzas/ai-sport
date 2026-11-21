import { forwardModelRequest } from "@/lib/model-api";

export async function POST(request: Request) {
  return forwardModelRequest(request, "Football", "predict");
}
