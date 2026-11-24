const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');

const root = join(__dirname, '..');
const window = {};
runInNewContext(readFileSync(join(root, 'assets/reasoning.js'), 'utf8'), { window, URL });
const providers = JSON.parse(readFileSync(join(root, 'data/providers.json'), 'utf8')).providers;

function options(providerId, model, properties = {}) {
  const provider = providers.find(item => item.id === providerId);
  const config = { provider, model, baseURL: provider.baseURL, format: provider.format, endpoint: provider.endpointOverride };
  const { choices } = window.reasoningFor({ ...config, ...properties });
  return Object.fromEntries(choices.map(choice => [choice.value, JSON.parse(JSON.stringify(choice.body))]));
}

test('OpenAI uses the model card and generates the body for the selected endpoint', () => {
  const model = 'example-model';
  const sourceModel = { id: model, reasoningEfforts: ['none', 'low'], reasoningFormats: ['openai_chat', 'openai_responses'] };
  assert.deepEqual(options('openai', model, { sourceModel }).off, { reasoning_effort: 'none' });
  const responses = { format: 'openai_responses', sourceModel };
  assert.deepEqual(options('openai', model, responses).low, { reasoning: { effort: 'low' } });
  sourceModel.reasoningFormats = ['openai_chat'];
  assert.deepEqual(options('openai', model, responses), {});
  sourceModel.reasoningEfforts = ['low'];
  assert.equal(options('openai', model, { sourceModel }).off, undefined);
  assert.deepEqual(options('openai', 'other-model', { sourceModel }), {});
  assert.deepEqual(options('openai', model, { sourceModel, baseURL: 'https://proxy.example' }), {});
  assert.deepEqual(options('openai', model, { sourceModel, endpoint: '/custom/path' }), {});
});

test('required reasoning and an actual off switch produce different settings', () => {
  assert.equal(options('glm', 'glm-5.3').off, undefined);
  assert.deepEqual(options('glm', 'glm-5.3').low, { reasoning_effort: 'low' });
  assert.deepEqual(options('deepseek', 'deepseek-flash').off, { thinking: { type: 'disabled' } });
});

test('Gemini minimal effort and a zero thinking budget use different fields', () => {
  const model = 'example-model';
  const levels = options('gemini', model, { sourceModel: { id: model, thinkingLevels: ['minimal', 'low'] } });
  assert.equal(levels.off, undefined);
  assert.deepEqual(levels.minimal, { generationConfig: { thinkingConfig: { thinkingLevel: 'minimal' } } });
  const lite = 'gemini-2.5-flash-lite';
  const sourceModel = { id: lite, thinkingBudget: { off: 0, min: 512, max: 24576, dynamic: -1 } };
  assert.deepEqual(options('gemini', lite, { sourceModel }).off, { generationConfig: { thinkingConfig: { thinkingBudget: 0 } } });
});
