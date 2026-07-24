<template>
  <router-view :key="$route.fullPath" />
</template>

<style>
html,
body,
#app {
  margin: 0;
  height: 100%;
  background: #0b111b;
  color: #d5e0ec;
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
* {
  box-sizing: border-box;
}
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-thumb {
  background: #223144;
  border-radius: 4px;
}
</style>
