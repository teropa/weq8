import { css } from "lit";

export const sharedStyles = css`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  :host {
    background-color: #111;
    color: white;
    --font-stack: Corbel, "Lucida Grande", "Lucida Sans Unicode", "Lucida Sans",
      "DejaVu Sans", "Bitstream Vera Sans", "Liberation Sans", Verdana,
      "Verdana Ref", sans-serif;
    --font-size: 9px;
    font-family: var(--font-stack);
    font-size: var(--font-size);
  }
`;
