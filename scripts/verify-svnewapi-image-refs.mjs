import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const source = readFileSync('src/providers/svnewapi.ts', 'utf8')

assert.match(
	source,
	/const refImages: string\[\] = Array\.isArray\(params\?\.refImages\)/,
	'SV NewAPI image generation must read params.refImages.',
)

assert.match(
	source,
	/const imageUrls = await Promise\.all\(refImages\.map\(ref => uploadRefMedia\('SV NewAPI image', ref\)\)\)/,
	'SV NewAPI image generation must prepare reference images once.',
)

assert.match(
	source,
	/body\.image = imageUrls/,
	'SV NewAPI image generation must send reference images as image for seeded BytePlus Seedream.',
)

assert.match(
	source,
	/body\.image_urls = imageUrls/,
	'SV NewAPI image generation must send reference images as image_urls for seeded APIMart.',
)

console.log('SV NewAPI image reference checks passed.')
