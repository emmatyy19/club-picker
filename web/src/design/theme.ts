import {
  Button,
  createTheme,
  NumberInput,
  SegmentedControl,
} from "@mantine/core";

export const greenTheme = createTheme({
  primaryColor: "sage",
  primaryShade: 7,
  fontFamily: '"Nunito Sans", sans-serif',
  headings: { fontFamily: '"Nunito Sans", sans-serif', fontWeight: "900" },
  defaultRadius: "md",
  colors: {
    teal: [
      "#f2f5eb",
      "#e7eedc",
      "#d4e2c7",
      "#bdcfaa",
      "#a1ba8b",
      "#85a16f",
      "#6b8958",
      "#52734d",
      "#3b593b",
      "#193d31",
    ],
    sage: [
      "#f2f5eb",
      "#e7eedc",
      "#d4e2c7",
      "#bdcfaa",
      "#a1ba8b",
      "#85a16f",
      "#6b8958",
      "#52734d",
      "#3b593b",
      "#193d31",
    ],
  },
  components: {
    Button: Button.extend({ defaultProps: { size: "sm", radius: "xl" } }),
    NumberInput: NumberInput.extend({ defaultProps: { size: "md" } }),
    SegmentedControl: SegmentedControl.extend({
      defaultProps: { size: "sm", radius: "xl", color: "sage.7" },
    }),
  },
});
