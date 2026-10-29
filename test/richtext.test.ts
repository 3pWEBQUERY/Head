import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { generateJSON } from '@tiptap/html/server';
import { fromDoc, toHtml } from '../web/src/lib/richtext.ts';

const extensions = [StarterKit.configure({ heading: false, bulletList: false, orderedList: false, listItem: false, listKeymap: false, code: false, codeBlock: false, strike: false, underline: false, link: false })];
const roundtrip = (text: string) => fromDoc(generateJSON(toHtml(text), extensions));

test('Lapis-Format übersteht den Editor unverändert', () => {
  getSchema(extensions);
  const samples = [
    'Ein Satz.',
    'Erster Absatz.\n\nZweiter Absatz mit **fett** und *kursiv*.',
    'Die Astern haben aufgegeben,\nnur eine steht noch, trotzig, lila,\nals hätte niemand ihr gesagt.',
    '> Ein Zitat\n> über zwei Zeilen\n\nDanach Text.',
    'Vorher.\n\n***\n\nNachher.',
    'Ganz **_fett und kursiv_** hier.',
    '5 * 3 * 2 bleibt Mathe.',
    'Sonderzeichen <b>nicht</b> & so.',
  ];
  for (const s of samples) assert.equal(roundtrip(s), s);
  // Alte Schreibweise _kursiv_ wird zu *kursiv* normalisiert.
  assert.equal(roundtrip('ein _kursives_ Wort'), 'ein *kursives* Wort');
});
