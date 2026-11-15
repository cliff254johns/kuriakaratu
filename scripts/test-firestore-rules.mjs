import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const projectId = 'demo-kuriakaratu';
const rules = fs.readFileSync('firestore.rules', 'utf8');
const testEnv = await initializeTestEnvironment({ projectId, firestore: { rules } });

try {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/admin-1'), { role: 'admin' });
    await setDoc(doc(db, 'users/finance-1'), { role: 'finance' });
    await setDoc(doc(db, 'users/client-1'), { role: 'client' });
    await setDoc(doc(db, 'cases/case-1'), { clientId: 'client-1', title: 'Confidential' });
  });

  const admin = testEnv.authenticatedContext('admin-1', { email: 'admin@example.com' }).firestore();
  const finance = testEnv.authenticatedContext('finance-1', { email: 'finance@example.com' }).firestore();
  const client = testEnv.authenticatedContext('client-1', { email: 'client@example.com' }).firestore();
  const stranger = testEnv.authenticatedContext('stranger-1', { email: 'stranger@example.com' }).firestore();
  const unauth = testEnv.unauthenticatedContext().firestore();

  await assertSucceeds(getDoc(doc(admin, 'cases/case-1')));
  await assertSucceeds(getDoc(doc(finance, 'invoices/invoice-1')).catch(async () => {
    // Read of a missing document is still subject to rules; a successful result is expected.
    return getDoc(doc(finance, 'invoices/invoice-1'));
  }));
  await assertFails(getDoc(doc(finance, 'cases/case-1')));
  await assertFails(getDoc(doc(client, 'cases/case-1')));
  await assertFails(getDoc(doc(stranger, 'users/admin-1')));
  await assertFails(getDoc(doc(unauth, 'cases/case-1')));

  await assertSucceeds(setDoc(doc(client, 'clientAccounts/client-1'), {
    uid: 'client-1', approved: false, status: 'pending', role: 'client',
    clientId: null, email: 'client@example.com'
  }));
  await assertFails(setDoc(doc(client, 'clientAccounts/client-1'), {
    uid: 'client-1', approved: true, status: 'approved', role: 'client',
    clientId: 'case-1', email: 'client@example.com'
  }));
  await assertFails(setDoc(doc(stranger, 'clientAccounts/client-1'), {
    uid: 'client-1', approved: false, status: 'pending', role: 'client',
    clientId: null, email: 'client@example.com'
  }));
  await assertSucceeds(setDoc(doc(finance, 'invoices/invoice-1'), { amount: 100 }));
  await assertFails(setDoc(doc(finance, 'cases/unauthorised'), { title: 'No' }));

  console.log('PASS: admin private-case access');
  console.log('PASS: finance-only invoice access and case denial');
  console.log('PASS: client and unauthenticated private-data denial');
  console.log('PASS: pending-only self-registration and anti-impersonation checks');
  console.log('PASS: default-deny behavior');
} finally {
  await testEnv.cleanup();
}