const width = 595.28;
const height = 841.89;
const margin = 38;
const contentWidth = width - margin * 2;

function pdfText(value, font) {
  return Array.from(String(value ?? '').normalize('NFC'), char => {
    if (/\s/u.test(char)) return ' ';
    try {
      font.encodeText(char);
      return char;
    } catch {
      return '';
    }
  }).join('');
}

function wrap(value, font, size, maxWidth = contentWidth) {
  const lines = [];
  for (const paragraph of String(value ?? '').split(/\r?\n/)) {
    const words = pdfText(paragraph, font).trim().split(/\s+/);
    let line = '';
    for (const word of words) {
      const joined = line ? line + ' ' + word : word;
      if (font.widthOfTextAtSize(joined, size) <= maxWidth) {
        line = joined;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      for (const character of word) {
        if (line && font.widthOfTextAtSize(line + character, size) > maxWidth) {
          lines.push(line);
          line = '';
        }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

function legend(objects, equipment) {
  const labels = [];
  const types = new Set(objects.map(object => object.type));
  for (const [type, name] of Object.entries(equipment)) {
    if (!types.has(type)) continue;
    if (type === 'hurdle') {
      const heights = [...new Set(objects.filter(object => object.type === type).map(object => object.height || 15))]
        .sort((a, b) => a - b);
      labels.push('Ostacoli ' + heights.join('/') + ' cm');
    } else if (type === 'run') labels.push('Corsa (freccia gialla)');
    else if (type === 'pass') labels.push('Passaggio (freccia azzurra tratteggiata)');
    else labels.push(name);
  }
  return labels.join(' · ');
}

export async function buildTrainingPdf(session, equipment, renderField, pdfLib, logoBytes) {
  const {PDFDocument, StandardFonts, rgb} = pdfLib;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = logoBytes ? await pdf.embedPng(logoBytes) : null;
  const black = rgb(.10,.095,.11);
  const red = rgb(.67,.08,.19);
  const gray = rgb(.29,.27,.30);
  const pale = rgb(.89,.87,.89);
  const white = rgb(1,1,1);
  const total = session.exercises.reduce((sum, exercise) => sum + Number(exercise.minutes), 0);
  const date = session.training_date.split('-').reverse().join('/');
  const sessionTitle = pdfText(session.title.trim(), bold);
  pdf.setTitle(sessionTitle || 'Seduta di allenamento');
  pdf.setAuthor('Volla United Academy');
  pdf.setSubject('Scheda di allenamento · Mister Igea');

  function text(page, value, x, y, size, face = font, color = black) {
    if (value) page.drawText(value, {x, y, size, font:face, color});
  }

  function rule(page, y) {
    page.drawLine({start:{x:margin,y},end:{x:width-margin,y},thickness:.75,color:pale});
  }

  function sheet() {
    const page = pdf.addPage([width,height]);
    page.drawRectangle({x:0,y:height-70,width,height:70,color:black});
    page.drawRectangle({x:0,y:height-73,width,height:3,color:red});
    if (logo) {
      const dimensions = logo.scaleToFit(34,34);
      page.drawImage(logo, {x:margin,y:height-52,...dimensions});
    }
    const labelX = margin + (logo ? 46 : 0);
    text(page,'VOLLA UNITED ACADEMY',labelX,height-32,14,bold,white);
    text(page,'SEDUTA DI ALLENAMENTO  /  MISTER IGEA',labelX,height-49,9,font,white);
    let y = height - 104;
    for (const line of wrap(sessionTitle || 'Seduta di allenamento',bold,21)) {
      text(page,line,margin,y,21,bold);
      y -= 25;
    }
    const info = [date, session.category.trim(), total + ' min totali', session.exercises.length + (session.exercises.length === 1 ? ' esercizio' : ' esercizi')].filter(Boolean).join('  ·  ');
    for (const line of wrap(info,font,11)) {
      text(page,line,margin,y,11,font,gray);
      y -= 15;
    }
    rule(page,y+1);
    return {page,y:y-23};
  }

  for (const [index, exercise] of session.exercises.entries()) {
    let {page,y} = sheet();
    const exerciseTitle = exercise.title?.trim() || 'Esercizio ' + (index+1);
    const heading = String(index+1).padStart(2,'0') + '   ' + exerciseTitle;
    for (const line of wrap(heading,bold,16)) {
      text(page,line,margin,y,16,bold);
      y -= 19;
    }
    text(page,exercise.minutes + ' min',margin,y,11,bold,red);
    y -= 15;
    const objects = exercise.objects || [];
    if (objects.length) {
      const field = await pdf.embedPng(renderField(objects));
      const dimensions = field.scaleToFit(contentWidth, 315);
      page.drawImage(field, {x:margin+(contentWidth-dimensions.width)/2,y:y-dimensions.height,...dimensions});
      y -= dimensions.height+17;
      for (const line of wrap(legend(objects,equipment),font,9.5)) {
        text(page,line,margin,y,9.5,font,gray);
        y -= 13;
      }
      y -= 8;
    }
    const notes = exercise.notes?.trim();
    if (!notes) continue;
    text(page,'OBIETTIVO E SVOLGIMENTO',margin,y,10,bold,red);
    y -= 19;
    for (const line of wrap(notes,font,11)) {
      if (y < 62) {
        ({page,y} = sheet());
        for (const titleLine of wrap(heading + ' (continua)',bold,15)) {
          text(page,titleLine,margin,y,15,bold);
          y -= 18;
        }
        y -= 12;
      }
      text(page,line,margin,y,11);
      y -= 15.5;
    }
  }

  const pages = pdf.getPages();
  pages.forEach((page,index) => {
    rule(page,44);
    text(page,'Volla United Academy · Area tecnica',margin,29,9,font,gray);
    const number = (index+1) + ' / ' + pages.length;
    text(page,number,width-margin-font.widthOfTextAtSize(number,9),29,9,font,gray);
  });
  return pdf.save();
}

export async function downloadTrainingPdf(session, equipment, renderField) {
  const [pdfLib,logoBytes] = await Promise.all([
    import('https://esm.sh/pdf-lib@1.17.1'),
    fetch('./logo.png').then(response => response.ok ? response.arrayBuffer() : null).catch(() => null)
  ]);
  const bytes = await buildTrainingPdf(session,equipment,renderField,pdfLib,logoBytes);
  const slug = session.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64);
  const url = URL.createObjectURL(new Blob([bytes], {type:'application/pdf'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Allenamento-' + session.training_date + (slug ? '-' + slug : '') + '.pdf';
  document.body.append(link);
  link.click();
  setTimeout(() => link.remove(),1000);
  setTimeout(() => URL.revokeObjectURL(url),120000);
}
