// Real browser smoke test. Credentials remain in ignored private runtime files.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.GENOPATH_PLAYWRIGHT_MODULE || path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root = process.env.GENOPATH_DEMO_ROOT || path.resolve(__dirname, '..');
const base = process.env.GENOPATH_DEMO_URL || 'http://localhost:3000';
const fixture = path.join(root, '.runtime', 'fixture');
const evidence = path.join(root, '.runtime', 'evidence');
const credentials = JSON.parse(fs.readFileSync(path.join(root, '.runtime', 'browser-private.json')));
const checks = [];
const pass = name => { checks.push(name); console.log('PASS ' + name); };
const runSuffix = Date.now().toString(36);
const user = credentials.username + '_' + runSuffix;
const otherUser = credentials.other_username + '_' + runSuffix;

async function unlock(page) {
  await page.locator('#demo-password').fill(credentials.gate_test_password);
  await page.getByRole('button', { name: 'Buka GenoPath', exact: true }).click();
  await page.locator('#demo-password').waitFor({ state: 'hidden' });
  await page.goto(base + '/login');
}

async function api(page, route, options = {}) {
  return page.evaluate(async ({ route, options }) => {
    const response = await fetch(route, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    return { status: response.status, data: await response.json() };
  }, { route, options });
}

async function review(page) {
  const state = JSON.parse(fs.readFileSync(path.join(evidence, 'additional-runtime.json')));
  await page.goto(base + '/login');
  await unlock(page);
  await page.locator('#username').fill(credentials.latest_username);
  await page.locator('#password').fill(credentials.password);
  await page.locator('form button[type=submit]').click();
  await page.waitForURL('**/analisis-baru');
  const exampleDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unduh FASTQ contoh sintetis', exact: true }).click();
  const example = await exampleDownload;
  const examplePath = path.join(evidence, example.suggestedFilename());
  await example.saveAs(examplePath);
  assert.deepEqual(fs.readFileSync(examplePath), fs.readFileSync(path.join(fixture, 'reads.fastq.gz')));
  await page.locator('#reference').selectOption('1');
  await page.locator('#ploidy').selectOption('2');
  await page.getByRole('switch').click();
  await page.screenshot({ path: path.join(evidence, 'upload-desktop.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(evidence, 'upload-mobile.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(base + '/jobs/' + state.empty_qual_999_job + '/result');
  await page.getByText('Tidak ada record yang cocok dengan filter ini.', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(evidence, 'results-empty.png'), fullPage: true, animations: 'disabled' });
  await page.goto(base + '/jobs/' + state.failed_reference_mismatch_job);
  await page.getByText('Workflow execution failed.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Lihat Hasil', exact: true }).count(), 0);
  await page.screenshot({ path: path.join(evidence, 'monitoring-failed.png'), fullPage: true, animations: 'disabled' });
  await page.reload();
  await page.getByText('Workflow execution failed.', { exact: true }).waitFor();
  await page.goto(base + '/');
  await page.getByRole('link', { name: 'Mulai Analisis', exact: false }).first().waitFor();
  await page.screenshot({ path: path.join(evidence, 'homepage.png'), fullPage: true, animations: 'disabled' });
  fs.writeFileSync(path.join(evidence, 'browser-review.json'), JSON.stringify({
    upload_desktop_mobile: 'PASS', empty_result: 'PASS', failed_job_refresh: 'PASS', homepage: 'PASS',
    browser: 'Edge', scope: 'local production server', external_e2e: false,
  }, null, 2));
  pass('browser login, upload desktop/mobile, empty result, Failed Job/refresh and homepage');
}

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const context = await browser.newContext({ acceptDownloads: true, reducedMotion: 'reduce', viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    if (process.env.GENOPATH_REVIEW_ONLY === '1') {
      await review(page);
      await context.close();
      return;
    }
    const statuses = new Set();
    page.on('response', async response => {
      if (/\/api\/jobs\/\d+$/.test(response.url()) && response.ok()) {
        try { statuses.add((await response.json()).status); } catch {}
      }
    });
    await page.goto(base + '/login');
    assert.equal(await page.locator('#demo-password').count(), 1);
    for (const route of ['/api/auth/login', '/api/auth/register', '/api/samples/upload-and-run', '/api/jobs/1/start', '/api/jobs/1/vcf', '/api/jobs/1/csv']) {
      assert.equal((await api(page, route, { method: 'POST' })).status, 401);
    }
    await page.locator('#demo-password').fill('deliberately-wrong-demo-password');
    const deniedGate = page.waitForResponse(r => r.url().endsWith('/_demo/unlock'));
    await page.getByRole('button', { name: 'Buka GenoPath', exact: true }).click();
    const wrongGateResponse = await deniedGate;
    if (wrongGateResponse.status() !== 401) {
      const headers = await wrongGateResponse.request().allHeaders();
      console.log('Gate diagnostic:', JSON.stringify({
        status: wrongGateResponse.status(), origin: headers.origin, host: headers.host,
        csrf_cookie_sent: (headers.cookie || '').includes('genopath_demo_csrf='),
        cookies: (await context.cookies()).map(c => ({name:c.name, secure:c.secure, domain:c.domain, sameSite:c.sameSite})),
      }));
    }
    assert.equal(wrongGateResponse.status(), 401, 'wrong-password response: ' + await page.getByRole('alert').innerText());
    await page.getByRole('alert').filter({ hasText: 'Password demo tidak cocok.' }).waitFor();
    await unlock(page);
    const gateCookies = await context.cookies();
    const gateCookie = gateCookies.find(c => c.name === 'genopath_demo_access');
    assert.ok(gateCookie.httpOnly && gateCookie.secure && gateCookie.sameSite === 'Lax');
    assert.equal((await api(page, '/api/jobs')).status, 401);
    pass('server gate protects direct APIs; wrong password rejected; secure cookie unlock keeps JWT mandatory');
    await page.getByRole('button', { name: /^\+ Buat Akun Baru/ }).click();
    const inputs = page.locator('form input');
    await inputs.nth(0).fill(user);
    await inputs.nth(1).fill('Pengujian E2E Terisolasi');
    await inputs.nth(2).fill(user + '@example.invalid');
    await inputs.nth(3).fill(credentials.password);
    const registration = page.waitForResponse(r => r.url().endsWith('/api/auth/register'));
    await page.locator('form button[type=submit]').click();
    assert.equal((await registration).status(), 201);
    await page.waitForURL('**/analisis-baru');
    pass('browser register -> login -> authenticated analysis form');
    let submissions = 0;
    page.on('request', req => { if (req.method() === 'POST' && req.url().includes('/samples/upload-and-run')) submissions++; });
    let inputPath = path.join(fixture, 'reads.fastq');
    if (process.env.GENOPATH_GZIP === '1') {
      const exampleDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Unduh FASTQ contoh sintetis', exact: true }).click();
      const example = await exampleDownload;
      inputPath = path.join(evidence, example.suggestedFilename());
      await example.saveAs(inputPath);
      assert.deepEqual(fs.readFileSync(inputPath), fs.readFileSync(path.join(fixture, 'reads.fastq.gz')));
      pass('authenticated demo fixture download matches reproducible gzip input byte-for-byte');
    }
    await page.locator('#fastq').setInputFiles(inputPath);
    await page.locator('#reference').selectOption('1');
    await page.locator('#ploidy').selectOption('2');
    await page.getByRole('switch').click();
    await page.locator('#qual').fill('25');
    await page.locator('#dp').fill('8');
    assert.equal(submissions, 0);
    pass('file selection/configuration sends no submission');
    const accepted = page.waitForResponse(r => r.url().includes('/samples/upload-and-run'));
    await page.getByRole('button', { name: 'Jalankan Analisis', exact: true }).click();
    const response = await accepted;
    assert.equal(response.status(), 202);
    const receipt = await response.json();
    const id = receipt.job.id_job;
    assert.equal(receipt.dispatch_scheduled, true);
    assert.equal(receipt.job.status, 'Queued');
    statuses.add('Queued');
    await page.waitForURL('**/jobs/' + id);
    pass('explicit submission accepted and direct Job navigation works');
    await page.getByRole('link', { name: 'Lihat Hasil', exact: true }).waitFor({ timeout: 180000 });
    await page.screenshot({ path: path.join(evidence, 'monitoring.png'), fullPage: true });
    await page.getByRole('link', { name: 'Lihat Hasil', exact: true }).click();
    await page.getByRole('heading', { name: 'Tabel Varian', exact: true }).waitFor();
    const result = await page.evaluate(async id => {
      const headers = { Authorization: 'Bearer ' + localStorage.getItem('access_token') };
      const summary = await (await fetch('/api/jobs/' + id + '/result', { headers })).json();
      const variants = await (await fetch('/api/jobs/' + id + '/variants', { headers })).json();
      return { summary, variants };
    }, id);
    assert.equal(result.summary.status, 'Completed');
    assert.equal(result.summary.execution_mode, 'nextflow');
    assert.equal(result.summary.parameters.parameter_qual, 25);
    assert.equal(result.summary.parameters.parameter_dp, 8);
    assert.equal(result.summary.counts.total_variants, 2);
    assert.equal(result.summary.reference.sumber, 'genopath:synthetic-fixture');
    assert.deepEqual(result.variants.items.map(v => v.position).sort((a,b)=>a-b), [5001, 12001]);
    assert.equal(submissions, 1);
    await page.reload();
    await page.getByRole('heading', { name: 'Tabel Varian', exact: true }).waitFor();
    await page.screenshot({ path: path.join(evidence, 'results.png'), fullPage: true });
    pass('real Nextflow -> VCF -> PostgreSQL result API -> browser result/refresh');
    const exports = {};
    for (const format of ['vcf', 'csv']) {
      const downloaded = page.waitForEvent('download');
      await page.getByRole('button', { name: format === 'vcf' ? 'Unduh VCF hasil analisis' : 'Unduh CSV seluruh hasil sesuai filter', exact: true }).click();
      const file = await downloaded;
      assert.match(file.suggestedFilename(), new RegExp('GenoPath_Job_' + id + '.*\\.' + format + '$'));
      const destination = path.join(evidence, file.suggestedFilename());
      await file.saveAs(destination);
      const content = fs.readFileSync(destination, 'utf8');
      const rows = content.trim().split(/\r?\n/).filter(line => format !== 'vcf' || !line.startsWith('#'));
      const count = rows.length - (format === 'csv' ? 1 : 0);
      assert.equal(count, result.summary.counts.total_variants);
      assert.ok(content.includes('5001') && content.includes('12001'));
      exports[format] = { filename: file.suggestedFilename(), records: count, bytes: Buffer.byteLength(content) };
    }
    pass('real browser VCF and all-result CSV downloads match persisted variants');
    await page.locator('#variant-type').selectOption('snp');
    const filteredPage = page.waitForResponse(r => r.url().includes('/variants?') && r.url().includes('variant_type=snp'));
    await page.getByRole('button', { name: 'Terapkan filter', exact: true }).click();
    assert.equal((await filteredPage).status(), 200);
    await page.getByText('Filter aktif: snp;', { exact: false }).waitFor();
    const filteredFile = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Unduh CSV seluruh hasil sesuai filter', exact: true }).click();
    const filteredDownload = await filteredFile;
    const filteredDestination = path.join(evidence, 'filtered_snp.csv');
    await filteredDownload.saveAs(filteredDestination);
    assert.equal(fs.readFileSync(filteredDestination, 'utf8').trim().split(/\r?\n/).length - 1, 1);
    await page.locator('#variant-type').selectOption('');
    await page.getByRole('button', { name: 'Terapkan filter', exact: true }).click();
    await page.getByText('Filter aktif: semua tipe;', { exact: false }).waitFor();
    pass('CSV export follows applied server filter; whole-analysis VCF remains separate');
    const replay = await page.evaluate(async ({ url, encoded, filename }) => {
      const form = new FormData();
      const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
      form.append('file', new File([bytes], filename, { type: 'application/octet-stream' }));
      const response = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + localStorage.getItem('access_token') }, body: form });
      const receipt = await response.json();
      return { status: response.status, job_id: receipt.job?.id_job, submission_status: receipt.submission_status, dispatch_scheduled: receipt.dispatch_scheduled };
    }, { url: response.url(), encoded: fs.readFileSync(inputPath).toString('base64'), filename: path.basename(inputPath) });
    assert.equal(replay.status, 202);
    assert.equal(replay.job_id, id);
    assert.equal(replay.submission_status, 'replayed');
    assert.equal(replay.dispatch_scheduled, false);
    pass('same UUID/file/parameters replay reuses completed Job without redispatch');
    assert.ok((await page.locator('body').innerText()).includes('INPUT SINTETIS TERKONTROL'));
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(evidence, 'results-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.getByTitle('Beralih ke Mode Malam').click();
    assert.ok(await page.locator('html').evaluate(element => element.classList.contains('dark')));
    await page.reload();
    await page.getByRole('heading', { name: 'Tabel Varian', exact: true }).waitFor();
    assert.ok(await page.locator('html').evaluate(element => element.classList.contains('dark')));
    await page.waitForFunction(() => parseInt(getComputedStyle(document.querySelector('.glass-card')).backgroundColor.match(/\d+/)[0]) < 30);
    await page.screenshot({ path: path.join(evidence, 'results-dark.png'), fullPage: true, animations: 'disabled' });
    pass('result viewer responsive layout has no page overflow at 390px');
    const anonymous = await browser.newContext();
    const anonymousPage = await anonymous.newPage();
    await anonymousPage.goto(base + '/login');
    assert.equal((await anonymous.request.get(base + '/api/jobs')).status(), 401);
    assert.equal((await anonymous.request.post(base + '/api/samples/upload-and-run')).status(), 401);
    await unlock(anonymousPage);
    assert.equal((await api(anonymousPage, '/api/jobs')).status, 401);
    assert.equal((await api(anonymousPage, '/api/demo/reads.fastq.gz')).status, 401);
    assert.equal((await api(anonymousPage, '/api/samples/upload-and-run', { method: 'POST' })).status, 401);
    assert.equal((await api(anonymousPage, '/api/auth/register', { method: 'POST', body: {
      username: otherUser, nama: 'Ownership test', email: otherUser + '@example.invalid',
      password: credentials.other_password,
    } })).status, 201);
    const login = await api(anonymousPage, '/api/auth/login', { method: 'POST', body: { username: otherUser, password: credentials.other_password } });
    assert.equal(login.status, 200);
    const token = login.data.access_token;
    for (const suffix of ['', '/result', '/variants', '/vcf', '/csv']) assert.equal((await api(anonymousPage, '/api/jobs/' + id + suffix, { headers: { Authorization: 'Bearer ' + token } })).status, 404);
    pass('anonymous rejection and cross-user ownership');
    await anonymous.close();
    fs.writeFileSync(path.join(evidence, 'browser-e2e.json'), JSON.stringify({
      checks, job_id: id, statuses: [...statuses], counts: result.summary.counts, parameters: result.summary.parameters, exports, replay,
      execution_mode: 'nextflow', input_kind: 'controlled synthetic fixture', biological_validation: false,
      browser: browser.version(), url: base,
    }, null, 2));
    await context.close();
  } finally { await browser.close(); }
})().catch(error => {
  let message = String(error.message);
  for (const secret of [credentials.password, credentials.other_password, credentials.gate_test_password]) if (secret) message = message.replaceAll(secret, '[redacted]');
  console.error('E2E FAIL:', error.name, message.slice(0, 350)); process.exitCode = 1;
});
