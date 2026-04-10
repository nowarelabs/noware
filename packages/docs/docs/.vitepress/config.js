"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitepress_1 = require("vitepress");
exports.default = (0, vitepress_1.defineConfig)({
    description: "Nomo framework documentation",
    // Markdown configuration
    markdown: {
        lineNumbers: true,
        theme: {
            light: 'github-light',
            dark: 'github-dark'
        }
    },
    themeConfig: {
        siteTitle: "",
        logo: { light: '/assets/nomo.png', dark: '/assets/nomo-dark.png' },
        // Search
        search: {
            provider: 'local'
        },
        // Social links
        socialLinks: [
            { icon: 'github', link: 'https://github.com/nowarelabs/nomo' }
        ],
        // Table of contents
        outline: {
            level: [2, 3],
            label: 'On this page'
        },
        nav: [
            { text: 'Home', link: '/' },
            { text: 'Guide', link: '/packages/getting-started' },
            { text: 'API', link: '/packages/controllers' }
        ],
        sidebar: [
            {
                text: 'Getting Started',
                items: [
                    { text: 'Quick Start', link: '/packages/getting-started' },
                    { text: 'Architecture', link: '/packages/architecture' },
                    { text: 'Examples', link: '/packages/examples' }
                ]
            },
            {
                text: 'Core',
                items: [
                    { text: 'Overview', link: '/packages/overview' },
                    { text: 'Controllers', link: '/packages/controllers' },
                    { text: 'Router', link: '/packages/router' },
                    { text: 'Services', link: '/packages/services' },
                    { text: 'Models', link: '/packages/models' },
                    { text: 'Logger', link: '/packages/logger' },
                    { text: 'Domains', link: '/packages/domains' }
                ]
            },
            {
                text: 'HTTP & Views',
                items: [
                    { text: 'Entrypoints', link: '/packages/entrypoints' },
                    { text: 'Views', link: '/packages/views' },
                    { text: 'Assets', link: '/packages/assets' },
                    { text: 'NoFo', link: '/packages/nofo' }
                ]
            },
            {
                text: 'Serverless',
                items: [
                    { text: 'Durable Objects', link: '/packages/durable-objects' },
                    { text: 'Jobs', link: '/packages/jobs' },
                    { text: 'RPC', link: '/packages/rpc' }
                ]
            },
            {
                text: 'Data',
                items: [
                    { text: 'SQL', link: '/packages/sql' },
                    { text: 'Migrations', link: '/packages/migrations' }
                ]
            },
            {
                text: 'Utilities',
                items: [
                    { text: 'Validators', link: '/packages/validators' },
                    { text: 'Normalizers', link: '/packages/normalizers' },
                    { text: 'Formatters', link: '/packages/formatters' },
                    { text: 'Result', link: '/packages/result' },
                    { text: 'Shared', link: '/packages/shared' }
                ]
            }
        ],
        // Edit link
        editLink: {
            text: 'Edit this page',
            pattern: 'https://github.com/nowarelabs/nomo/edit/main/packages/docs/docs/:path'
        },
        // Last updated
        lastUpdated: {
            text: 'Last updated'
        },
        // Footer
        footer: {
            message: 'Released under the MIT License.',
            copyright: 'Copyright © 2024-present Nomo Framework'
        }
    },
    head: [
        ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
        ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
        ['link', { href: 'https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,200..1000;1,6..12,200..1000&family=JetBrains+Mono:wght@400;500;600&display=swap', rel: 'stylesheet' }]
    ]
});
