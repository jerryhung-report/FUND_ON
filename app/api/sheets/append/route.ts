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

    // Prepare data for Google Sheets
    // Columns: Code, Name, Effective Date, PM Sign, Ops Sign, GM Sign, Archive Time
    const values = records.map((record: any) => [
      record.code,
      record.name,
      record.effectiveDate,
      record.pmSign,
      record.opsSign,
      record.gmSign,
      new Date().toISOString()
    ]);

    // Append to sheet (assumes the first sheet is where to append)
    await sheets.spreadsheets.values.append({
      spreadsheetId: targetSheetId,
      range: 'Sheet1!A2', // Adjust range/sheet name as needed
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Google Sheets error:', error);
    return NextResponse.json({ error: error.message || 'Failed to sync with Google Sheets' }, { status: 500 });
  }
}
