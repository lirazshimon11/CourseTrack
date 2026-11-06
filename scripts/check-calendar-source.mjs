// Read-only diagnostic. Does not connect to Supabase or write calendar data.
import { readSource } from '../server/calendar-sync.mjs';
try {
  const result = await readSource({ adapter:'hit-v1', page_url:'https://www.hit.ac.il/students/calender/' });
  console.log(JSON.stringify(result,null,2));
} catch(error) {
  console.error('Calendar source could not be validated:',error.cause?.code ?? error.message);
  console.error('TLS verification stays enabled. No data has been changed.');
  process.exitCode=1;
}
