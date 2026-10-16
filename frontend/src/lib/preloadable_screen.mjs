// Author: Jonathan Kakesa (JonathanK-N). Preload code without mounting private screens.
import { createElement, lazy } from "react";

export function preloadableScreen(load) {
  let loaded;
  let pending;
  const preload = () => {
    if (!pending) {
      pending = load().then(module => {
        loaded = module.default;
        return module;
      });
    }
    return pending;
  };
  const LazyScreen = lazy(preload);
  function Screen(props) {
    return createElement(loaded || LazyScreen, props);
  }
  Screen.preload = preload;
  return Screen;
}
