import * as fs from 'fs'
import * as path from 'path'
import { load } from "cheerio"
import { convertFxLayoutToTailwind } from './layout'
import { convertFxLayoutAlignToTailwind } from './layout-align'
import { convertFxLayoutGapToTailwind } from './layout-gap'

const fxAttributes = ["fxFill", "fxLayout", "fxLayoutAlign", "fxGap", "fxFlex"];

export function convertFlexLayoutToTailwind(filePath) {
  const html = fs.readFileSync(filePath, "utf-8");
  return extractHtmlTags(html).reduce(
    (html, tag) => html.replace(tag, convertTag(tag)),
    html
  );
}

export function convertTag(tag) {
  if (!fxAttributes.some((a) => tag.includes(a))) return tag;

  const $ = load(tag, { xmlMode: true, decodeEntities: false });

  $("[fxLayout], [fxLayoutGap], [fxLayoutAlign]").each((_, element) => {
    const $element = $(element);

    const fxLayout = $element.attr("fxLayout");
    const fxLayoutGap = $element.attr("fxLayoutGap");
    const fxLayoutAlign = $element.attr("fxLayoutAlign");

    if (fxLayoutAlign != undefined) {
      convertFxLayoutAlignToTailwind($element, fxLayoutAlign);
    }
    
    if (fxLayout !== undefined) {
      convertFxLayoutToTailwind($element, fxLayout);
    }

    if (fxLayoutGap != undefined) {
      convertFxLayoutGapToTailwind($element, fxLayout, fxLayoutGap);
    }
  });

  $("[fxFlex]").each((_, elem) => {
    let fxFlex = $(elem).attr("fxFlex");

    if (!fxFlex) {
      $(elem).addClass(`flex-1`).removeAttr("fxFlex");
      return;
    }

    if (fxFlex === "*") {
      $(elem).addClass(`flex-auto`).removeAttr("fxFlex");
      return;
    }

    let widthClass = "";
    switch (parseInt(fxFlex)) {
      case 33:
        widthClass = "1/3";
        break;
      case 66:
        widthClass = "2/3";
        break;
      case 100:
        widthClass = "full";
        break;
      default:
        widthClass = percentageToFraction(parseInt(fxFlex));
        break;
    }

    $(elem).addClass(`basis-${widthClass}`).removeAttr("fxFlex");
  });

  $("[fxFill]").each((_, elem) => {
    $(elem)
      .addClass(`h-full w-full min-h-full min-w-full`)
      .removeAttr("fxFill");
  });

  let newTag = $.html();
  newTag = newTag.replace(/(\W\w+)=""/gm, "$1");

  if (newTag.endsWith("/>") && tag.endsWith("/>")) {
    return newTag;
  } else {
    return newTag.slice(0, -2) + ">";
  }
}

export function gcd(a, b) {
  if (!b) {
    return a;
  }
  return gcd(b, a % b);
}

export function percentageToFraction(percentage) {
  const denominator = 100;
  const numerator = parseInt(percentage);
  const gcdValue = gcd(numerator, denominator);
  const simplifiedNumerator = numerator / gcdValue;
  const simplifiedDenominator = denominator / gcdValue;
  return `${simplifiedNumerator}/${simplifiedDenominator}`;
}

export function extractHtmlTags(html) {
  let openingTags = [];
  let tag = "";
  let inTag = false;
  let quote = null;

  for (const ch of [...html]) {
    if (!inTag && ch === "<") {
      inTag = true;
      tag += ch;
    } else if (inTag) {
      tag += ch;

      if (quote === null && (ch === '"' || ch === "'")) {
        quote = ch;
      } else if (quote !== null && ch === quote) {
        quote = null;
      } else if (quote === null && ch === ">") {
        openingTags.push(tag);
        tag = "";
        inTag = false;
      }
    }
  }

  return openingTags;
}

export function convertFile(filePath) {
  const convertedData = convertFlexLayoutToTailwind(filePath);
  fs.writeFileSync(filePath, convertedData, "utf-8");
  console.log(`File converted successfully: ${filePath}`);
}

export function processFiles(folderPath, processFile, processFolder, level = 0) {
  if (fs.existsSync(folderPath)) {
    // console.log(`folderPath: ${folderPath}`);
    fs.readdirSync(folderPath).forEach((file) => {
      const currentPath = path.join(folderPath, file);
      // console.log(`currentPath: ${currentPath}`);
      if (fs.lstatSync(currentPath).isDirectory()) {
        if (
          currentPath.endsWith("node_modules") ||
          currentPath.endsWith("dist")
        ) {
          return;
        }

        if (processFiles(currentPath, processFile, processFolder, level + 1)) {
          processFolder?.(currentPath);
        }
      } else {
        if (currentPath.endsWith(".html")) {
          processFile(currentPath, level);
        }
      }
    });
    return true;
  } else {
    console.log(`Could not find folderPath: ${folderPath}`);
    return false;
  }
}
