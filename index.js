/**
 * Glitch Application Browser and Launcher
 * @license MIT
 * @author Anders Evenrud <andersevenrud@gmail.com>
 */

import osjs from 'osjs';
import {h, app} from 'hyperapp';
import {Box, Button, TextField, Menubar, MenubarItem} from '@osjs/gui';
import {name as applicationName} from './metadata.json';

/**
 * Project List Entry Component
 */
const ProjectListItem = props => h('div', {
  style: {
    padding: '0.5em'
  }
}, [
  h('div', {
    style: {
      fontWeight: 'bold',
      fontSize: '120%'
    }
  }, props.project.domain),

  h('div', {
    style: {
      marginTop: '1em',
      marginBottom: '1em'
    }
  }, props.project.description || '(no description)'),

  h('div', {
    style: {
      maxWidth: '10em'
    }
  }, [
    h(Button, {
      onclick: props.onclick
    }, 'Launch')
  ])
]);

/**
 * Make Url for iframe
 */
const iframeUrl = project => `https://${project.domain}.glitch.me`;

/**
 * Make a request to Glitch API
 */
const fetchApi = endpoint => fetch(`https://api.glitch.com/v1/${endpoint}`)
  .then(response => response.json());

/**
 * Make a request to Glitch API for projects
 */
const fetchApiProjects = () => fetchApi('projects')
  .then(response => response.items);

/**
 * Filters the project list results
 */
const searchFilter = filter => (project) => {
  if (filter) {
    return project.domain.indexOf(filter) !== -1 ||
      project.description.indexOf(filter) !== -1;
  }

  return true;
};

/**
 * Creates main window UI
 */
const createMainUI = proc => ($content, win) => {
  const projectList = state => state
    .projects
    .filter(searchFilter(state.filter))
    .map(project => h(ProjectListItem, {
      onclick: () => proc.emit('glitch:launch', project),
      project
    }));

  const view = (state, actions) => h(Box, {}, [
    h(Menubar, {}, [
      h(MenubarItem, {
        onclick: () => proc.emit('glitch:open')
      }, 'Open...')
    ]),
    h(TextField, {
      value: state.filter,
      placeholder: 'Filter list...',
      oninput: (ev, value) => actions.setFilter(value)
    }),
    h(Box, {
      grow: 1,
      shrink: 1,
      style: {
        overflow: 'auto'
      }
    }, projectList(state))
  ]);

  const wired = app({
    filter: '',
    projects: []
  }, {
    setFilter: filter => ({filter}),
    setProjects: projects => ({projects})
  }, view, $content);

  win.on('glitch:projects', projects => wired.setProjects(projects));
};

/**
 * Creates glitch iframe window UI
 */
const createIframeUI = project => ($content) => {
  const iframe = document.createElement('iframe');
  iframe.src = iframeUrl(project);
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = '0 none';
  iframe.style.backgroundColor = '#fff';
  iframe.setAttribute('border', '0');
  $content.appendChild(iframe);
};

/**
 * Creates a new Glitch IFrame window for application
 */
const createGlitchWindow = proc => (project) => {
  const id = `GlitchWindow_${project.domain}`;
  const found = proc.windows.find(win => win.id === id);

  if (found) {
    return found.focus();
  }

  return proc
    .createWindow({
      id,
      title: `${proc.metadata.title.en_EN} - ${project.domain}`,
      position: 'center',
      dimension: {width: 400, height: 400},
    })
    .render(createIframeUI(project));
};

/**
 * Creates the main window
 */
const createMainWindow = (proc, metadata) => proc
  .createWindow({
    id: 'GlitchWindow',
    title: metadata.title.en_EN,
    dimension: {width: 400, height: 400}
  })
  .on('destroy', () => proc.destroy())
  .on('render', () => proc.emit('glitch:load'))
  .render(createMainUI(proc));

/**
 * Creates an error dialog
 */
const createErrorDialog = core => error => core
  .make('osjs/dialog', 'alert', {
    message: error
  }, () => {});

/**
 * Creates a dialog to request a custom Glitch app
 */
const createOpenDialog = (core, proc, win) => core
  .make('osjs/dialog', 'prompt', {
    message: 'Enter custom domain'
  }, {
    parent: win,
    attributes: {modal: true}
  }, (btn, value) => {
    if (btn === 'ok' && value) {
      const w = createGlitchWindow(proc)({domain: value});
      setTimeout(() => w.focus()); // Main window is focused after callback
    }
  });

/**
 * Application
 */
const createApplication = (core, args, options, metadata) => {
  const proc = core.make('osjs/application', {args, options, metadata});
  const win = createMainWindow(proc, metadata);

  proc.on('glitch:error', createErrorDialog(core));
  proc.on('glitch:launch', createGlitchWindow(proc));
  proc.on('glitch:open', () => createOpenDialog(core, proc, win));
  proc.on('glitch:load', () => {
    fetchApiProjects()
      .then(projects => win.emit('glitch:projects', projects))
      .catch(error => proc.emit('glitch:error', error));
  });


  return proc;
};

osjs.register(applicationName, createApplication);
