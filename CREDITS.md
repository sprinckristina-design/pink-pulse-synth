# Musical sources and sample credits

## Beethoven — Piano Sonata No. 14, Op. 27 No. 2, I. Adagio sostenuto

Composition: Ludwig van Beethoven. The composition is in the public domain.

Digital edition: **Mutopia-2007/02/11-276**, maintained by **Stewart Holmes**;
combined edition credited to **Chris Sawer and Stewart Holmes**. Based on
Berners, 1908, edited by A. Winterberger.

- Source: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=276
- Original MIDI archive: https://www.mutopiaproject.org/ftp/BeethovenLv/O27/moonlight/moonlight-mids.zip
- Original LilyPond archive: https://www.mutopiaproject.org/ftp/BeethovenLv/O27/moonlight/moonlight-lys.zip
- License: **Creative Commons Attribution-ShareAlike 2.5**
  https://creativecommons.org/licenses/by-sa/2.5/

The first movement MIDI and LilyPond source are included in `assets/moonlight/`.
`score.json` is an adaptation of this edition, distributed under the same
CC BY-SA 2.5 license. Pitches, note onset ticks and the full 69-bar form are
retained. `tools/import-moonlight.mjs` converts ticks to seconds at quarter = 54
(the tempo suggested in the LilyPond source), adds an editorial dynamic curve
and extends the final fermata. The player clears sustain every half-bar.
These dynamics, pedaling and tempo are a programmed interpretation, not an
authentic recording by Beethoven or an imitation of a specific pianist.
This is the complete **first movement**, not all three movements of the sonata.

The Mutopia Project distributes its material as-is, without a warranty of
musical or editorial correctness. See the source page and license.

To regenerate the score: `node tools/import-moonlight.mjs`.

## Salamander Grand Piano

Piano recordings: **Alexander Holm**, Yamaha C5, Salamander Grand Piano.

- MP3 distribution: https://github.com/Tonejs/audio/tree/master/salamander
- Original collection: https://archive.org/details/SalamanderGrandPianoV3
- License: **Creative Commons Attribution 3.0 Unported**
  https://creativecommons.org/licenses/by/3.0/

The 20 MP3 files in `assets/piano/` are copied unmodified from the Tone.js
distribution. Playback repitches the nearest recording by at most two semitones
for this score, applies a gain envelope and velocity-sensitive filter, and mixes
the notes in Web Audio. This lightweight player uses one sampled velocity layer,
not the original library's complete 16-layer engine. No recorded performance
of the sonata is used. Sample licenses are separate from the application code.
