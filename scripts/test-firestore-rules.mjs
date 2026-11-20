import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc
} from 'firebase/firestore';

const projectId = 'demo-kuriakaratu';
const rules = fs.readFileSync('firestore.rules', 'utf8');
const testEnv = await initializeTestEnvironment({ projectId, firestore: { rules } });

try {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/admin-1'), { role: 'admin' });
    await setDoc(doc(db, 'users/finance-1'), { role: 'finance' });
    await setDoc(doc(db, 'users/clerk-1'), { role: 'clerk' });
    await setDoc(doc(db, 'users/client-1'), { role: 'client' });
    await setDoc(doc(db, 'clientAccounts/client-1'), {
      uid: 'client-1', email: 'client@example.com', approved: true, status: 'approved',
      role: 'client', clientId: 'cl-1'
    });
    await setDoc(doc(db, 'clientAccounts/client-2'), {
      uid: 'client-2', email: 'other@example.com', approved: true, status: 'approved',
      role: 'client', clientId: 'cl-2'
    });
    await setDoc(doc(db, 'clients/cl-1'), { name: 'Client One', phone: '0711000000', address: '', preferredContact: 'WhatsApp', feeAgreement: { totalFees: 10000 } });
    await setDoc(doc(db, 'clients/cl-2'), { name: 'Client Two', phone: '0722000000' });
    await setDoc(doc(db, 'cases/case-1'), { clientId: 'cl-1', title: 'Client One confidential case' });
    await setDoc(doc(db, 'cases/case-2'), { clientId: 'cl-2', title: 'Client Two confidential case' });
    await setDoc(doc(db, 'documents/doc-1'), { clientId: 'cl-1', name: 'Client One file' });
    await setDoc(doc(db, 'documents/doc-2'), { clientId: 'cl-2', name: 'Client Two file' });
    await setDoc(doc(db, 'tasks/task-1'), { clientId: 'cl-1', title: 'Client One hearing' });
    await setDoc(doc(db, 'invoices/invoice-1'), { clientId: 'cl-1', amount: 100 });
    await setDoc(doc(db, 'invoices/invoice-2'), { clientId: 'cl-2', amount: 200 });
    await setDoc(doc(db, 'receipts/receipt-1'), { clientId: 'cl-1', amount: 50 });
    await setDoc(doc(db, 'clientMessages/message-1'), { clientId: 'cl-1', body: 'Private message' });
    await setDoc(doc(db, 'clientNotifications/notice-1'), { clientId: 'cl-1', read: false });
    await setDoc(doc(db, 'settings/company'), { logoBase64: 'data:image/png;base64,AA==' });
  });

  const admin = testEnv.authenticatedContext('admin-1', { email: 'admin@example.com' }).firestore();
  const finance = testEnv.authenticatedContext('finance-1', { email: 'finance@example.com' }).firestore();
  const clerk = testEnv.authenticatedContext('clerk-1', { email: 'clerk@example.com' }).firestore();
  const client = testEnv.authenticatedContext('client-1', { email: 'client@example.com' }).firestore();
  const otherClient = testEnv.authenticatedContext('client-2', { email: 'other@example.com' }).firestore();
  const stranger = testEnv.authenticatedContext('stranger-1', { email: 'stranger@example.com' }).firestore();
  const newClient = testEnv.authenticatedContext('client-new', { email: 'new@example.com' }).firestore();
  const unauth = testEnv.unauthenticatedContext().firestore();
  const owner = testEnv.authenticatedContext('owner-1', {
    email: 'admin@kuriakaratu.com', email_verified: true
  }).firestore();
  const unverifiedOwner = testEnv.authenticatedContext('owner-unverified', {
    email: 'admin@kuriakaratu.com', email_verified: false
  }).firestore();

  // Owner bootstrap is restricted to the exact verified owner identity.
  await assertSucceeds(setDoc(doc(owner, 'users/owner-1'), {
    email: 'admin@kuriakaratu.com', role: 'admin'
  }));
  await assertSucceeds(getDoc(doc(owner, 'cases/case-1')));
  await assertFails(setDoc(doc(unverifiedOwner, 'users/owner-unverified'), {
    email: 'admin@kuriakaratu.com', role: 'admin'
  }));

  // Staff can update their own last-login timestamp, but cannot elevate roles.
  await assertSucceeds(updateDoc(doc(clerk, 'users/clerk-1'), { lastLogin: '2026-11-20 10:00:00' }));
  await assertFails(updateDoc(doc(clerk, 'users/clerk-1'), { role: 'admin' }));
  await assertFails(getDocs(collection(stranger, 'users')));

  await assertSucceeds(getDoc(doc(admin, 'cases/case-1')));
  await assertSucceeds(getDoc(doc(clerk, 'cases/case-1')));
  await assertFails(getDoc(doc(finance, 'cases/case-1')));
  await assertSucceeds(getDoc(doc(client, 'cases/case-1')));
  await assertFails(getDoc(doc(client, 'cases/case-2')));
  await assertSucceeds(getDoc(doc(otherClient, 'cases/case-2')));
  await assertFails(getDoc(doc(stranger, 'cases/case-1')));
  await assertFails(getDoc(doc(unauth, 'cases/case-1')));

  await assertSucceeds(getDocs(query(collection(client, 'cases'), where('clientId', '==', 'cl-1'))));
  await assertFails(getDocs(collection(client, 'cases')));

  await assertSucceeds(getDoc(doc(client, 'clients/cl-1')));
  await assertFails(getDoc(doc(client, 'clients/cl-2')));
  await assertSucceeds(updateDoc(doc(client, 'clients/cl-1'), { phone: '0711222333', profileUpdatedAt: '2026-11-16 10:00:00' }));
  await assertFails(updateDoc(doc(client, 'clients/cl-1'), { feeAgreement: { totalFees: 1 } }));

  await assertSucceeds(getDoc(doc(client, 'documents/doc-1')));
  await assertFails(getDoc(doc(client, 'documents/doc-2')));
  await assertSucceeds(setDoc(doc(client, 'documents/client-upload'), {
    fileId: 'client-upload', name: 'statement.pdf', clientId: 'cl-1', ownerUid: 'client-1',
    uploadedBy: 'client@example.com', uploadedByRole: 'client', base64: 'data:application/pdf;base64,AA==',
    sizeBytes: 20, mimeType: 'application/pdf'
  }));
  await assertFails(setDoc(doc(client, 'documents/forged-upload'), {
    fileId: 'forged-upload', name: 'other.pdf', clientId: 'cl-2', ownerUid: 'client-1',
    uploadedBy: 'client@example.com', uploadedByRole: 'client', base64: 'data:application/pdf;base64,AA==',
    sizeBytes: 20, mimeType: 'application/pdf'
  }));

  await assertSucceeds(getDoc(doc(client, 'invoices/invoice-1')));
  await assertFails(getDoc(doc(client, 'invoices/invoice-2')));
  await assertSucceeds(setDoc(doc(finance, 'invoices/invoice-new'), { amount: 100 }));
  await assertFails(setDoc(doc(clerk, 'invoices/invoice-clerk'), { amount: 100 }));
  await assertSucceeds(getDoc(doc(client, 'receipts/receipt-1')));
  await assertFails(setDoc(doc(client, 'receipts/forged'), { amount: 100 }));

  await assertSucceeds(getDoc(doc(client, 'tasks/task-1')));
  await assertSucceeds(updateDoc(doc(client, 'tasks/task-1'), {
    cancelRequested: true, cancelRequestedAt: '2026-11-16 10:00:00',
    cancelRequestedBy: 'client@example.com'
  }));
  await assertFails(updateDoc(doc(client, 'tasks/task-1'), { status: 'Cancelled' }));

  await assertSucceeds(setDoc(doc(client, 'clientMessages/client-message'), {
    clientId: 'cl-1', clientName: 'Client One', clientEmail: 'client@example.com',
    senderUid: 'client-1', sender: 'client', senderRole: 'client',
    subject: 'Question', body: 'Please call me.', createdAt: '2026-11-16 10:00:00', read: false
  }));
  await assertFails(setDoc(doc(client, 'clientMessages/forged-message'), {
    clientId: 'cl-2', clientEmail: 'client@example.com', senderUid: 'client-1',
    sender: 'client', senderRole: 'client', body: 'Spoof', createdAt: '2026-11-16'
  }));

  await assertSucceeds(getDoc(doc(client, 'clientNotifications/notice-1')));
  await assertSucceeds(updateDoc(doc(client, 'clientNotifications/notice-1'), { read: true }));
  await assertFails(updateDoc(doc(client, 'clientNotifications/notice-1'), { title: 'Forged notice' }));
  await assertSucceeds(getDoc(doc(client, 'settings/company')));
  await assertFails(getDoc(doc(client, 'settings/docSections')));
  await assertFails(getDoc(doc(unauth, 'settings/company')));
  await assertFails(getDoc(doc(admin, 'unlistedCollection/private-doc')));

  await assertSucceeds(setDoc(doc(newClient, 'clientAccounts/client-new'), {
    uid: 'client-new', approved: false, status: 'pending', role: 'client',
    clientId: null, email: 'new@example.com'
  }));
  await assertFails(setDoc(doc(newClient, 'clientAccounts/client-new'), {
    uid: 'client-new', approved: true, status: 'approved', role: 'client',
    clientId: 'cl-1', email: 'new@example.com'
  }));
  await assertFails(setDoc(doc(stranger, 'clientAccounts/client-new'), {
    uid: 'client-new', approved: false, status: 'pending', role: 'client',
    clientId: null, email: 'new@example.com'
  }));
  await assertFails(setDoc(doc(finance, 'cases/unauthorised'), { title: 'No' }));

  console.log('PASS: verified owner can bootstrap the first admin profile');
  console.log('PASS: unverified owner identity cannot bootstrap admin access');
  console.log('PASS: staff can update only their own lastLogin, not elevate roles');
  console.log('PASS: public users cannot enumerate staff profiles');
  console.log('PASS: client isolation across cases, documents, invoices and appointments');
  console.log('PASS: client profile updates are restricted to contact fields');
  console.log('PASS: client uploads and messages are identity-bound');
  console.log('PASS: finance and clerk permissions remain role-scoped');
  console.log('PASS: notification updates are restricted to read status');
  console.log('PASS: pending-only self-registration and default-deny checks');
} finally {
  await testEnv.cleanup();
}
