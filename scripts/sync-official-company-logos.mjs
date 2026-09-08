import fs from 'node:fs/promises';

const required=['public/company-cr.webp'];
for(const file of required){
  await fs.access(file);
  console.log(`Validated ${file}`);
}
