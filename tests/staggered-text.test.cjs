const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const modulePath = path.join(__dirname, '..', 'staggered-text.js');

test('exposes the documented default staggered-text configuration', () => {
  assert.equal(fs.existsSync(modulePath), true, 'staggered-text.js must exist');
  const { DEFAULTS } = require(modulePath);

  assert.deepEqual(DEFAULTS, {
    segmentBy: 'words',
    delay: 80,
    duration: 0.6,
    threshold: 0.1,
    rootMargin: '0px',
    direction: 'top',
    blur: true,
    staggerDirection: 'forward',
    respectReducedMotion: true,
    exitOnScrollOut: false,
  });
});

test('segments English and Chinese copy into readable stagger units', () => {
  assert.equal(fs.existsSync(modulePath), true, 'staggered-text.js must exist');
  const { segmentText } = require(modulePath);

  assert.deepEqual(segmentText('Design With Purpose', 'en'), ['Design', ' ', 'With', ' ', 'Purpose']);
  assert.deepEqual(segmentText('设计师作品集', 'zh-CN'), ['设计', '师', '作品', '集']);
});

test('uses an 80ms forward delay for each visible segment', () => {
  assert.equal(fs.existsSync(modulePath), true, 'staggered-text.js must exist');
  const { getSegmentDelay } = require(modulePath);

  assert.equal(getSegmentDelay(0), 0);
  assert.equal(getSegmentDelay(1), 80);
  assert.equal(getSegmentDelay(5), 400);
});
