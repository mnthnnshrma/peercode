import React, { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, StateField, StateEffect, Annotation, ChangeSet } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { Decoration } from '@codemirror/view';
import ACTIONS from '../Actions.js';

const remoteChangeAnnotation = Annotation.define();
const addAuthorMark = StateEffect.define();

const authorMarkField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(marks, tr) {
    marks = marks.map(tr.changes);
    for (let e of tr.effects) {
      if (e.is(addAuthorMark)) {
        marks = marks.update({
          add: [e.value.deco.range(e.value.from, e.value.to)]
        });
      }
    }
    return marks;
  },
  provide: f => EditorView.decorations.from(f)
});

const userColors = {};
const colors = ['red', 'blue', 'green', 'orange', 'purple', 'cyan', 'magenta', 'yellow'];
let colorIndex = 0;

function getUserColor(socketId) {
  if (!userColors[socketId]) {
    userColors[socketId] = colors[colorIndex % colors.length];
    colorIndex++;
  }
  return userColors[socketId];
}

const Editor = ({ socketRef, roomId, onCodeChange }) => {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const codeRef = useRef(''); 

  useEffect(() => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of(update => {
      if (update.changes && update.docChanged) {
        const newCode = update.state.doc.toString();
        codeRef.current = newCode;
        onCodeChange(newCode);

        // Only broadcast if this change was made locally by the user
        if (!update.transactions.some(tr => tr.annotation(remoteChangeAnnotation))) {
          if (socketRef.current) {
            socketRef.current.emit(ACTIONS.CODE_CHANGE, {
              roomId,
              changes: update.changes.toJSON(),
            });
          }
        }
      }
    });

    const state = EditorState.create({
      doc: '',
      extensions: [basicSetup, javascript(), oneDark, authorMarkField, updateListener],
    });

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    });

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (socketRef.current) {
      const handleCodeChange = ({ code, changes, socketId }) => {
        if (!viewRef.current) return;

        if (code !== undefined) {
          // Full initial sync
          const currentDoc = viewRef.current.state.doc.toString();
          if (currentDoc !== code) {
            viewRef.current.dispatch({
              changes: { from: 0, to: currentDoc.length, insert: code },
              annotations: [remoteChangeAnnotation.of(true)]
            });
          }
        } else if (changes && socketId) {
          // Incremental peer change
          const changeSet = ChangeSet.fromJSON(changes);
          const effects = [];
          
          const color = getUserColor(socketId);
          const mark = Decoration.mark({ class: `cm-author-${color}` });
          
          changeSet.iterChanges((fromA, toA, fromB, toB, inserted) => {
            if (fromB < toB) {
              effects.push(addAuthorMark.of({ from: fromB, to: toB, deco: mark }));
            }
          });

          viewRef.current.dispatch({
            changes: changeSet,
            effects: effects,
            annotations: [remoteChangeAnnotation.of(true)]
          });
        }
      };

      socketRef.current.on(ACTIONS.CODE_CHANGE, handleCodeChange);

      return () => {
        socketRef.current.off(ACTIONS.CODE_CHANGE, handleCodeChange);
      };
    }
  }, [socketRef.current]);

  return <div ref={editorRef} style={{ height: '100%', width: '100%' }} />;
};

export default Editor;
