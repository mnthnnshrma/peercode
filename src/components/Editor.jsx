import React, { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import ACTIONS from '../Actions.js';

const Editor = ({ socketRef, roomId, onCodeChange }) => {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const codeRef = useRef(''); 

  useEffect(() => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of(update => {
      if (update.changes) {
        const newCode = update.state.doc.toString();

      
        if (newCode !== codeRef.current) {
          codeRef.current = newCode;
          onCodeChange(newCode);

          if (socketRef.current) {
            socketRef.current.emit(ACTIONS.CODE_CHANGE, {
              roomId,
              code: newCode,
            });
          }
        }
      }
    });

    const state = EditorState.create({
      doc: '',
      extensions: [basicSetup, javascript(), oneDark, updateListener],
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
      const handleCodeChange = ({ code }) => {
        if (code !== null && viewRef.current) {
          const currentDoc = viewRef.current.state.doc.toString();

          if (currentDoc !== code) {
            codeRef.current = code;
            viewRef.current.dispatch({
              changes: {
                from: 0,
                to: currentDoc.length,
                insert: code,
              },
            });
          }
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
