/** Shared presentation only; numerical chart calculations stay in their modules. */
export const chartTheme = {
  textStyle: { fontFamily: "Nunito Sans, sans-serif", color: "#193d31" },
  backgroundColor: "transparent",
};

/** Date zoom controls share their geometry and affordances in every chart. */
export const dateSliderStyle = {
  type: "slider" as const,
  height: 36,
  bottom: 16,
  handleSize: "110%",
  handleIcon: "path://M-6,-18 L6,-18 L6,18 L-6,18 Z",
  handleStyle: {
    color: "#fffdf7",
    borderColor: "#52734d",
    borderWidth: 2,
  },
  fillerColor: "rgba(82,115,77,0.2)",
  backgroundColor: "#f2f5eb",
  borderColor: "#c8d6bb",
  showDataShadow: false,
  brushSelect: false,
  showDetail: false,
  filterMode: "none" as const,
};
