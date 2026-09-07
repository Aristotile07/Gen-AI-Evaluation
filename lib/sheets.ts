import { google } from 'googleapis';

// GOOGLE_SERVICE_ACCOUNT_JSON env var should hold the FULL JSON key file content as a string
function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var is missing');
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getSheetsClient() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

export interface ResponseRow {
  timestamp: string;
  uid: string;
  projectName: string;
  githubLink: string;
  aiUsageAnswer: string;
  aiUsageDescription: string;
  knownIssues: string;
  rowIndex: number; // 1-based row number in the sheet, for reference
}

// Reads the raw form-response sheet. Adjust range/columns if the form layout changes.
export async function readResponseSheet(): Promise<ResponseRow[]> {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.RESPONSE_SHEET_ID!;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Sheet1!A2:G', // A: Timestamp, B: UID, C: Project, D: GitHub Link, E: Used AI, F: Description, G: Known Issues
  });
  const rows = res.data.values || [];
  return rows.map((r, i) => ({
    timestamp: r[0] || '',
    uid: r[1] || '',
    projectName: r[2] || '',
    githubLink: r[3] || '',
    aiUsageAnswer: r[4] || '',
    aiUsageDescription: r[5] || '',
    knownIssues: r[6] || '',
    rowIndex: i + 2,
  }));
}

const OUTPUT_HEADERS = [
  'Timestamp Evaluated',
  'UID',
  'Project Name',
  'GitHub Link',
  'Link Status',
  'Duplicate Flag',
  'Project Score (0-100)',
  'Project Feedback',
  'Voice Gate Passed',
  'AI Use Score (0-100)',
  'AI Use Level',
  'AI Use Reason',
  'Text Authenticity Note',
  'Repo Analysis Note',
  'Manual Review Needed',
  'Processing Status',
];

// Ensures the output sheet has the correct header row (only writes if blank/missing)
export async function ensureOutputSheetHeaders() {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.OUTPUT_SHEET_ID!;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Sheet1!A1:P1',
  });
  const existing = res.data.values?.[0] || [];
  if (existing.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [OUTPUT_HEADERS] },
    });
  }
}

export interface OutputRow {
  uid: string;
  projectName: string;
  githubLink: string;
  linkStatus: string;
  duplicateFlag: string;
  projectScore: number | null;
  projectFeedback: string;
  voiceGatePassed: boolean | null;
  aiUseScore: number | null;
  aiUseLevel: string;
  aiUseReason: string;
  textAuthenticityNote: string;
  repoAnalysisNote: string;
  manualReviewNeeded: boolean;
  processingStatus: string;
}

// Appends one evaluated row to the output sheet. Called per-submission after pipeline finishes.
export async function appendOutputRow(row: OutputRow) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.OUTPUT_SHEET_ID!;
  await ensureOutputSheetHeaders();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Sheet1!A1',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [
        [
          new Date().toISOString(),
          row.uid,
          row.projectName,
          row.githubLink,
          row.linkStatus,
          row.duplicateFlag,
          row.projectScore ?? '',
          row.projectFeedback,
          row.voiceGatePassed === null ? '' : row.voiceGatePassed ? 'Yes' : 'No',
          row.aiUseScore ?? '',
          row.aiUseLevel,
          row.aiUseReason,
          row.textAuthenticityNote,
          row.repoAnalysisNote,
          row.manualReviewNeeded ? 'Yes' : 'No',
          row.processingStatus,
        ],
      ],
    },
  });
}

// For a forced re-evaluation of a UID: find its row in the output sheet and overwrite it
// instead of appending a duplicate. Returns true if an existing row was found+updated.
export async function upsertOutputRow(row: OutputRow): Promise<boolean> {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.OUTPUT_SHEET_ID!;
  await ensureOutputSheetHeaders();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Sheet1!B:B', // UID column
  });
  const uidColumn = res.data.values || [];
  const existingIndex = uidColumn.findIndex((r) => r[0] === row.uid);

  if (existingIndex === -1) {
    await appendOutputRow(row);
    return false;
  }

  const rowNumber = existingIndex + 1; // 1-based
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Sheet1!A${rowNumber}:P${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        [
          new Date().toISOString(),
          row.uid,
          row.projectName,
          row.githubLink,
          row.linkStatus,
          row.duplicateFlag,
          row.projectScore ?? '',
          row.projectFeedback,
          row.voiceGatePassed === null ? '' : row.voiceGatePassed ? 'Yes' : 'No',
          row.aiUseScore ?? '',
          row.aiUseLevel,
          row.aiUseReason,
          row.textAuthenticityNote,
          row.repoAnalysisNote,
          row.manualReviewNeeded ? 'Yes' : 'No',
          row.processingStatus,
        ],
      ],
    },
  });
  return true;
}
