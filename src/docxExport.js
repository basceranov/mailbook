import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  UnderlineType,
  ExternalHyperlink,
  PageBreak,
  TableOfContents
} from "docx";
import { saveAs } from "file-saver";
import { toRoman } from "./roman.js";

function textRunFromNode(node, marks = []) {
  if (!node?.text) return new TextRun("");
  const style = {
    text: node.text,
    bold: false,
    italics: false,
    strike: false,
    underline: undefined,
    highlight: undefined
  };

  for (const mark of marks || node.marks || []) {
    switch (mark.type) {
      case "bold": style.bold = true; break;
      case "italic": style.italics = true; break;
      case "strike": style.strike = true; break;
      case "underline": style.underline = { type: UnderlineType.SINGLE }; break;
      case "highlight": style.highlight = "yellow"; break;
    }
  }
  return new TextRun(style);
}

function inlineRuns(content = []) {
  const runs = [];
  for (const node of content) {
    if (node.type === "text") {
      const linkMark = (node.marks || []).find(m => m.type === "link");
      if (linkMark?.attrs?.href) {
        runs.push(new ExternalHyperlink({
          link: linkMark.attrs.href,
          children: [textRunFromNode(node)]
        }));
      } else {
        runs.push(textRunFromNode(node));
      }
    } else if (node.type === "hardBreak") {
      runs.push(new TextRun({ break: 1 }));
    }
  }
  return runs;
}

function alignmentFromAttrs(attrs = {}) {
  switch (attrs.textAlign) {
    case "center": return AlignmentType.CENTER;
    case "right": return AlignmentType.RIGHT;
    case "justify": return AlignmentType.JUSTIFIED;
    default: return AlignmentType.LEFT;
  }
}

function nodeToParagraphs(node, listContext = null) {
  if (!node) return [];

  if (node.type === "paragraph") {
    return [new Paragraph({
      children: inlineRuns(node.content),
      alignment: alignmentFromAttrs(node.attrs),
      spacing: { after: 150, line: 320 }
    })];
  }

  if (node.type === "bulletList" || node.type === "orderedList") {
    const ordered = node.type === "orderedList";
    const out = [];
    (node.content || []).forEach((item, idx) => {
      const firstPara = (item.content || []).find(n => n.type === "paragraph");
      out.push(new Paragraph({
        children: [
          new TextRun({ text: ordered ? `${idx + 1}. ` : "• ", bold: ordered }),
          ...inlineRuns(firstPara?.content || [])
        ],
        indent: { left: 360, hanging: 180 },
        spacing: { after: 100, line: 300 }
      }));

      for (const sub of (item.content || []).filter(n => n !== firstPara)) {
        out.push(...nodeToParagraphs(sub, node.type));
      }
    });
    return out;
  }

  if (node.type === "blockquote") {
    const out = [];
    for (const child of node.content || []) {
      const paragraphs = nodeToParagraphs(child);
      for (const p of paragraphs) {
        p.options = p.options || {};
        out.push(p);
      }
    }
    return out;
  }

  return [];
}

function editorJsonToParagraphs(docJson) {
  const out = [];
  for (const node of docJson?.content || []) {
    out.push(...nodeToParagraphs(node));
  }
  return out;
}

export async function exportDocx(entries) {
  if (!entries.length) {
    throw new Error("Nessun testo da esportare");
  }

  const children = [];

  children.push(new Paragraph({
    text: "SOMMARIO",
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 500 }
  }));

  children.push(new Paragraph({
    text: "1. TESTI MAIL E TICKET",
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 200, after: 180 }
  }));

  entries.forEach((entry, index) => {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${toRoman(index + 1)}. `, bold: true }),
        new TextRun({ text: entry.title || "Senza titolo" })
      ],
      indent: { left: 360 },
      spacing: { after: 100 }
    }));
  });

  children.push(new Paragraph({ children: [new PageBreak()] }));

  entries.forEach((entry, index) => {
    children.push(new Paragraph({
      text: `${toRoman(index + 1)}. ${entry.title || "Senza titolo"}`,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: index === 0 ? 0 : 300, after: 240 },
      keepNext: true
    }));

    const body = editorJsonToParagraphs(entry.content);
    if (body.length) {
      children.push(...body);
    } else {
      children.push(new Paragraph({
        children: [new TextRun({ text: "(testo vuoto)", italics: true })]
      }));
    }

    if (index !== entries.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  });

  const doc = new Document({
    creator: "Mailbook",
    title: "Raccolta testi mail e ticket",
    description: "Documento generato da Mailbook",
    styles: {
      default: {
        document: {
          run: { font: "Aptos", size: 22 },
          paragraph: { spacing: { line: 320 } }
        }
      },
      paragraphStyles: [
        {
          id: "Title",
          name: "Title",
          basedOn: "Normal",
          next: "Normal",
          run: { size: 36, bold: true, font: "Aptos Display" },
          paragraph: { spacing: { after: 420 } }
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 26, bold: true, font: "Aptos Display" },
          paragraph: { spacing: { before: 240, after: 180 }, keepNext: true }
        }
      ]
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1100, right: 1150, bottom: 1100, left: 1150 }
        }
      },
      children
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, "Raccolta_testi_mail_e_ticket.docx");
}
