import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";

const DB_NAME = "kuhula_db";
const COLLECTION_NAME = "financial_states";
const DOCUMENT_ID = "global_state";

export async function GET() {
  try {
    if (!process.env.MONGODB_URI || !clientPromise) {
      return NextResponse.json(
        { error: "MongoDB not configured" },
        { status: 503 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const doc = await db.collection(COLLECTION_NAME).findOne({ _id: DOCUMENT_ID as any });

    if (!doc || !doc.state) {
      return NextResponse.json({ state: null });
    }
    return NextResponse.json({ state: doc.state });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load state" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.MONGODB_URI || !clientPromise) {
      return NextResponse.json(
        { error: "MongoDB not configured" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { state } = body;

    if (!state) {
      return NextResponse.json(
        { error: "Missing state in request body" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    await db.collection(COLLECTION_NAME).updateOne(
      { _id: DOCUMENT_ID as any },
      { $set: { state, updatedAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to save state" },
      { status: 500 }
    );
  }
}
