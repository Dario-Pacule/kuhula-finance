import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient> | null = null;

if (uri) {
  if (process.env.NODE_ENV === "development") {
    // Em modo de desenvolvimento, usa uma variável global para que o valor
    // seja preservado durante reloads de módulos causados por HMR.
    let globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>;
    };

    if (!globalWithMongo._mongoClientPromise) {
      client = new MongoClient(uri, options);
      globalWithMongo._mongoClientPromise = client.connect();
    }
    clientPromise = globalWithMongo._mongoClientPromise;
  } else {
    // Em modo de produção, é melhor não usar uma variável global.
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
  }
}

// Exporta a promise de conexão. Pode ser null se a URI não estiver definida (ex: em build time).
export default clientPromise;
