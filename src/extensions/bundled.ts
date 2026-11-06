import { CalendarSection } from "./CalendarSection";
import { extensionHost } from "./host";

export const bundledReady = extensionHost.activate("dsp.calendar", {
  activate(api) {
    api.props.registerSection({
      id: "dsp.calendar/theme", title: "Calendar Theme", order: 10, component: CalendarSection,
    });
  },
});
