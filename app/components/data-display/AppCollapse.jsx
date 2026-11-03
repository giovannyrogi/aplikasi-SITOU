"use client";

import { Collapse } from "antd";
import {
  Collapse as MuiCollapse,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";

/** Shared disclosure foundation. Domain callers own labels, data and expansion state. */
export default function AppCollapse({ items = [], style, styles, ...props }) {
  return (
    <Collapse
      destroyOnHidden={false}
      {...props}
      style={{ width: "100%", minWidth: 0, ...style }}
      items={items}
      styles={(info) => {
        const resolved = typeof styles === "function" ? styles(info) : styles;
        return {
          ...resolved,
          header: { minHeight: 44, ...resolved?.header },
          title: { minWidth: 0, whiteSpace: "normal", ...resolved?.title },
        };
      }}
    />
  );
}

/** Controlled animated region for navigation, where the accessible trigger is external. */
export function AppCollapseRegion(props) {
  return <MuiCollapse {...props} />;
}

/** Compound adapter for existing report accordions; keeps their controlled IDs and layout. */
export function AppAccordion(props) {
  return <Accordion {...props} />;
}
export function AppAccordionSummary(props) {
  return <AccordionSummary {...props} />;
}
export function AppAccordionDetails(props) {
  return <AccordionDetails {...props} />;
}
