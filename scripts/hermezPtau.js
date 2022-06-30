const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// constants
const DEFAULT_CONSTRAINTS = 20;
const HERMEZ_DROPBOX_SHARED_URL = 'https://www.dropbox.com/sh/mn47gnepqu88mzl/AACaJkBU7mmCq8uU8ml0-0fma';
const PARAMS_PREFIX = '?preview=powersOfTau28_hez_final';
const OUTPUT_PATH = path.join(__dirname, '../zk/ptau/');
const CONSTRAINTS_ARGV = ['-c', '--constraints'];
const ARGV_ERROR = 'No args (node hermezPtau.js) or constraint spec < 28 (node hermezPtau.js -c 20)';
const DOWNLOAD_SELECTOR = '#fvsdk-container > div:nth-child(1) > header > div.rc-action-bar-container._actionBar_ji18g_50.rc-action-bar-container--responsive > div > span > button';
const DOWNLOADING_SELECTOR = 'body > div.ReactModalPortal > div > div > div > div.dig-Modal-body.dig-Modal-body--hasVerticalSpacing > h2';

/**
 * Pull an existing powers of tau ceremony output from Hermez for efficiency & save to disk
 * <3 Jordi Baylina: https://blog.hermez.io/hermez-cryptographic-setup/
 * @notice the use of this script is convenient for development but insecure for production
 * @param {number} -c, --constraints: number of constraints to use (default 20 for this project)
 */
async function main() {
    // get file uri
    const { url, constraints } = getPtauUrl();

    // create headless browser
    console.info('Launching headless browser page for dropbox');
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    // start file download
    console.info('Awaiting download selector');
    await page.waitForSelector(DOWNLOAD_SELECTOR);
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: OUTPUT_PATH
    })
    await page.click(DOWNLOAD_SELECTOR);
    await page.waitForSelector(DOWNLOADING_SELECTOR);
    console.info('Download starting');
    await new Promise(resolve => setTimeout(resolve, 2500));

    // wait until download is complete
    await page.goto("chrome://downloads");
    await page.bringToFront();
    // await page.waitForFunction(downloadCompleteSelector)
    const waitExpression = 'document'
        + '.querySelector("body > downloads-manager").shadowRoot'
        + '.querySelector("#frb0").shadowRoot'
        + '.querySelector("#content").innerText.includes("Show in folder")';
    await page.waitForFunction(waitExpression, { polling: 'raf', timeout: 0 });
    console.info(`Powers of Tau ceremony (2**${constraints} constraints) downloaded`);

    // set file name to be same as locally generated for compatability
    const _constraints = constraints.toString().length > 1 ? constraints.toString() : `0${constraints.toString()}`;
    const oldFileName = `powersOfTau28_hez_final_${_constraints}.ptau`;
    const newFileName = `pot${constraints}_final.ptau`;
    fs.renameSync(path.join(OUTPUT_PATH, oldFileName), path.join(OUTPUT_PATH, newFileName));
    console.info(`Wrote ptau ceremony output to ${path.join(OUTPUT_PATH, newFileName)}`)
}

/**
 * Determine the URL to access ptau ceremony output for
 * @return {string} url - the url to access the file from
 * @return {number} constraints - # of constraints chosen
 */
function getPtauUrl() {
    // determine constraint #
    let constraints;
    if (process.argv.length === 2) {
        // check argv for no preference
        constraints = DEFAULT_CONSTRAINTS;
    } else {
        // specified constraint input validation
        if (process.argv.length !== 4 || !(CONSTRAINTS_ARGV.includes(process.argv[2])))
            throw new Error(ARGV_ERROR);
        try {
            constraints = parseInt(process.argv[3]);
        } catch {
            throw new Error(`Constraint '${process.argv[3]}' is invalid integer <= 28`)
        }
        if (constraints > 28 || constraints < 1)
            throw new Error(`constraint value '${constraints}' does not satisfy 1 <= constraint <= 28`);
    }
    // marshall constraint choice into folder naming convention
    const _constraints = constraints.toString().length > 1 ? constraints.toString() : `0${constraints.toString()}`;
    // create url
    const params = constraints === 28 ? PARAMS_PREFIX : `${PARAMS_PREFIX}_${_constraints}`;
    return { url: `${HERMEZ_DROPBOX_SHARED_URL}${params}.ptau`, constraints };
}

/* Execute program on script invocation */
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });