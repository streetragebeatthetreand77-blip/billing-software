import { config } from 'dotenv';

config();

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "street-rage";
const collections = ["products", "transactions", "customers", "returns"];

async function clearCollections() {
  console.log(`Starting Firestore REST cleanup for project: ${projectId}`);
  
  for (const colName of collections) {
    console.log(`Fetching documents for collection: "${colName}"...`);
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${colName}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) {
          console.log(`Collection "${colName}" does not exist or has no documents.`);
          continue;
        }
        throw new Error(`Failed to fetch documents: ${response.statusText}`);
      }
      
      const data = await response.json();
      const documents = data.documents || [];
      console.log(`Found ${documents.length} documents in "${colName}".`);
      
      for (const doc of documents) {
        // Doc name is in format: projects/{project_id}/databases/(default)/documents/{collection_id}/{doc_id}
        const docPath = doc.name;
        const deleteUrl = `https://firestore.googleapis.com/v1/${docPath}`;
        console.log(`Deleting: ${docPath}...`);
        
        const delRes = await fetch(deleteUrl, { method: 'DELETE' });
        if (delRes.ok) {
          console.log(`Successfully deleted ${docPath}`);
        } else {
          console.error(`Failed to delete ${docPath}: ${delRes.statusText}`);
        }
      }
    } catch (error) {
      console.error(`Error clearing collection "${colName}":`, error);
    }
  }
}

clearCollections().then(() => {
  console.log("REST cleanup finished.");
});
