import { hasValidConfig } from "./firebase";
import { mockProducts, mockTransactions, mockCustomers, mockReturns, saveLocal } from "./mock";
import { app } from "./firebase";

// Dynamically import Firestore only if we have a valid configuration to avoid loading overhead or bundle failures
let dbInstance: any = null;
let firestoreModule: any = null;

async function getDb() {
  if (!hasValidConfig || !app) return null;
  if (dbInstance) return dbInstance;
  try {
    if (!firestoreModule) {
      firestoreModule = await import("firebase/firestore");
    }
    dbInstance = firestoreModule.getFirestore(app);
    return dbInstance;
  } catch (e) {
    console.error("Failed to initialize Firebase database client:", e);
    return null;
  }
}

export async function syncWithFirebase() {
  const db = await getDb();
  if (!db || !firestoreModule) return;
  
  try {
    const { getDocs, collection } = firestoreModule;

    // 1. Fetch products
    const productsSnap = await getDocs(collection(db, "products"));
    if (!productsSnap.empty) {
      const products = productsSnap.docs.map((doc: any) => doc.data());
      mockProducts.length = 0;
      products.forEach((p: any) => mockProducts.push(p));
      saveLocal("products", mockProducts);
    }

    // 2. Fetch customers
    const customersSnap = await getDocs(collection(db, "customers"));
    if (!customersSnap.empty) {
      const customers = customersSnap.docs.map((doc: any) => doc.data());
      mockCustomers.length = 0;
      customers.forEach((c: any) => mockCustomers.push(c));
      saveLocal("customers", mockCustomers);
    }

    // 3. Fetch transactions
    const txsSnap = await getDocs(collection(db, "transactions"));
    if (!txsSnap.empty) {
      const txs = txsSnap.docs.map((doc: any) => doc.data());
      mockTransactions.length = 0;
      txs.forEach((t: any) => mockTransactions.push(t));
      saveLocal("transactions", mockTransactions);
    }

    // 4. Fetch returns
    const returnsSnap = await getDocs(collection(db, "returns"));
    if (!returnsSnap.empty) {
      const returns = returnsSnap.docs.map((doc: any) => doc.data());
      mockReturns.length = 0;
      returns.forEach((r: any) => mockReturns.push(r));
      saveLocal("returns", mockReturns);
    }
  } catch (err) {
    console.error("Firebase DB Sync Error:", err);
  }
}

export async function saveProductToFirebase(product: any) {
  const db = await getDb();
  if (!db || !firestoreModule) return;
  try {
    const { doc, setDoc } = firestoreModule;
    await setDoc(doc(db, "products", product.id), product);
  } catch (err) {
    console.error("Firebase Save Product Error:", err);
  }
}

export async function deleteProductFromFirebase(productId: string) {
  const db = await getDb();
  if (!db || !firestoreModule) return;
  try {
    const { doc, deleteDoc } = firestoreModule;
    await deleteDoc(doc(db, "products", productId));
  } catch (err) {
    console.error("Firebase Delete Product Error:", err);
  }
}

export async function saveTransactionToFirebase(tx: any) {
  const db = await getDb();
  if (!db || !firestoreModule) return;
  try {
    const { doc, setDoc } = firestoreModule;
    await setDoc(doc(db, "transactions", tx.id), tx);
  } catch (err) {
    console.error("Firebase Save Transaction Error:", err);
  }
}

export async function saveCustomerToFirebase(customer: any) {
  const db = await getDb();
  if (!db || !firestoreModule) return;
  try {
    const { doc, setDoc } = firestoreModule;
    await setDoc(doc(db, "customers", customer.id), customer);
  } catch (err) {
    console.error("Firebase Save Customer Error:", err);
  }
}

export async function saveReturnToFirebase(ret: any) {
  const db = await getDb();
  if (!db || !firestoreModule) return;
  try {
    const { doc, setDoc } = firestoreModule;
    await setDoc(doc(db, "returns", ret.id), ret);
  } catch (err) {
    console.error("Firebase Save Return Error:", err);
  }
}

export async function clearAllFirebaseData() {
  const db = await getDb();
  if (!db || !firestoreModule) return;
  try {
    const { collection, getDocs, deleteDoc, doc } = firestoreModule;
    const collections = ["products", "transactions", "customers", "returns"];
    for (const colName of collections) {
      const snap = await getDocs(collection(db, colName));
      const deletePromises = snap.docs.map(async (d: any) => {
        await deleteDoc(doc(db, colName, d.id));
      });
      await Promise.all(deletePromises);
    }
  } catch (err) {
    console.error("Firebase Database Clear Error:", err);
    throw err;
  }
}
