# Automatic slab header colours

Phone scanner and batch scanner pass their original front File into the grading review. Once a card is marked professionally graded, the browser decodes a small 160-pixel-wide raster and samples the centre of the upper 6–40% of the photo. Dominant colour bins and a neutral-colour preference select a suggested label background and lower band. Text switches to black or white for contrast. This is a heuristic colour sampler, not label recognition or an authentication check.

The owner sees a swatch before final confirmation, with a vertical sample-position slider and two colour pickers to correct background, glare or framing mistakes. No external image API or model is called by colour detection. Existing scanner recognition/pricing behaviour is unchanged. This colour feature adds no paid service.

The three hex colours are saved in the existing grading JSON as `header_style: {background, accent, text}`. `readGrading` validates and copies only full hex values. No database schema change is needed. Changing the style clears grading confirmation. Public shop and product artwork use the stored style for confirmed slabs with catalogue art; actual photographs remain behind View photos. Existing Tentacruel's previously reviewed colour override remains a fallback until it is re-saved with a style. Existing listings are not backfilled.
