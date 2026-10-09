import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'tests',workers:1,fullyParallel:false,timeout:45000,
 use:{baseURL:process.env.VACANCY_TEST_URL||'http://127.0.0.1:48173',browserName:'chromium',headless:true,screenshot:'only-on-failure'},
 reporter:[['list'],['json',{outputFile:'test-results/results.json'}]],
});
