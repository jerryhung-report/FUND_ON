import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { records, sheetId } = body;

    if (!records || !Array.isArray(records)) {
      return NextResponse.json({ error: 'Invalid records' }, { status: 400 });
    }

    const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
    const targetSheetId = sheetId || process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !targetSheetId) {
      return NextResponse.json({ 
        error: 'Google Sheets configuration missing. Please set GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, and GOOGLE_SHEET_ID.' 
      }, { status: 500 });
    }

    // Initialize Auth
    const auth = new google.auth.JWT(
      clientEmail,
      undefined,
      privateKey.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });

    // --- Dynamic Sheet Discovery ---
    // Instead of assuming "Sheet1", let's find the first sheet name
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: targetSheetId,
    });
    
    const sheetName = spreadsheet.data.sheets?.[0]?.properties?.title || 'Sheet1';
    console.log(`Targeting sheet: ${sheetName}`);

    // --- Header Initialization ---
    // Check if we need to add headers (if row 1 is empty)
    const checkHeaders = await sheets.spreadsheets.values.get({
      spreadsheetId: targetSheetId,
      range: `${sheetName}!A1:G1`,
    });

    if (!checkHeaders.data.values || checkHeaders.data.values.length === 0) {
      console.log('Sheet is empty, initializing headers...');
      await sheets.spreadsheets.values.update({
        spreadsheetId: targetSheetId,
        range: `${sheetName}!A1:G1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['基金代碼', '基金名稱', '生效日期', 'PM 簽核日', '營運簽核日', '總經理簽核日', '歸檔時間']],
        },
      });
    }

    // Prepare data for Google Sheets
    // Columns: Code, Name, Effective Date, PM Sign, Ops Sign, GM Sign, Archive Time
    const values = records.map((record: any) => [
      record.code,
      record.name,
      record.effectiveDate,
      record.pmSign,
      record.opsSign,
      record.gmSign,
      new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
    ]);

    // Append to sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: targetSheetId,
      range: `${sheetName}!A2`, 
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values,
      },
    });

    console.log('Sheets Append Response:', response.status, response.statusText);

    return NextResponse.json({ success: true, sheetName });
  } catch (error: any) {
    console.error('Google Sheets error:', error);
    return NextResponse.json({ error: error.message || 'Failed to sync with Google Sheets' }, { status: 500 });
  }
}
