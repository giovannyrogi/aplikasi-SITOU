import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    files: ["app/**/*.{js,jsx,ts,tsx}"],
    ignores: ["app/components/modals/AppModal.jsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@mui/material",
              importNames: ["Modal", "Dialog", "DialogTitle", "DialogContent", "DialogActions"],
              message:
                "Gunakan AppModal atau ConfirmDialog bersama agar header, gulir, footer dan aksesibilitas konsisten.",
            },
            {
              name: "antd",
              importNames: ["Modal"],
              message: "Gunakan AppModal atau ConfirmDialog bersama, bukan modal AntD terpisah.",
            },
          ],
          patterns: [
            {
              group: [
                "@mui/material/Modal",
                "@mui/material/Dialog",
                "@mui/material/DialogTitle",
                "@mui/material/DialogContent",
                "@mui/material/DialogActions",
                "antd/es/modal",
                "antd/es/modal/**",
                "antd/lib/modal",
                "antd/lib/modal/**",
              ],
              message: "Modal aplikasi harus menyusun AppModal bersama.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='dialog']",
          message: "Gunakan AppModal bersama, bukan dialog HTML terpisah.",
        },
        {
          selector: "JSXAttribute[name.name='role'][value.value='dialog']",
          message: "Shell role=dialog hanya didefinisikan oleh AppModal.",
        },
        {
          selector: "JSXAttribute[name.name='scrollHeaderWithContent']",
          message:
            "Header AppModal selalu konsisten dan tetap terlihat. Hanya isi modal yang bergulir.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  {
    files: ["app/**/*.{js,jsx,ts,tsx}"],
    ignores: ["app/components/data-display/AppCollapse.jsx", "app/components/modals/AppModal.jsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportDeclaration[source.value='antd'] > ImportSpecifier[imported.name='Collapse']",
          message: "Gunakan AppCollapse bersama untuk pelipatan konten.",
        },
        {
          selector:
            "ImportDeclaration[source.value='@mui/material'] > ImportSpecifier[imported.name=/^(Collapse|Accordion|AccordionSummary|AccordionDetails)$/]",
          message:
            "Gunakan adapter AppCollapse bersama, termasuk region navigasi dan accordion laporan.",
        },
        {
          selector:
            "ImportDeclaration[source.value=/^(antd\\/(es|lib)\\/collapse|@mui\\/material\\/(Collapse|Accordion))/]",
          message: "Komponen pelipatan library hanya diimpor pada AppCollapse.",
        },
        { selector: "JSXOpeningElement[name.name='dialog']", message: "Gunakan AppModal bersama." },
        {
          selector: "JSXAttribute[name.name='role'][value.value='dialog']",
          message: "Shell role=dialog hanya didefinisikan oleh AppModal.",
        },
        {
          selector: "JSXAttribute[name.name='scrollHeaderWithContent']",
          message: "Header AppModal tetap terlihat.",
        },
      ],
    },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
