import React, { useState, useRef, useEffect } from "react";

// ID generator
function uuid() {
  return Math.random().toString(36).slice(2) + Date.now();
}

const COLORS = [
  "#FFE5E5", // Soft pink
  "#E5F3FF", // Baby blue
  "#F0E5FF", // Lavender
  "#E5FFE5", // Mint green
  "#FFF5E5", // Peach
  "#FFE5F5", // Rose
  "#E5FFFF", // Cyan
  "#FFFAE5"  // Cream
];

export default function App() {
  const [notes, setNotes] = useState([]);
  const [connections, setConnections] = useState([]); // {from, to}
  const [connecting, setConnecting] = useState(null);
  const connectingRef = useRef(null); // Ref to keep real-time connecting note ID
  const [connectLine, setConnectLine] = useState(null); // {fromPin:{x,y}, to:{x,y}}
  const [connectionJustFinished, setConnectionJustFinished] = useState(false);
  const [nearbyNote, setNearbyNote] = useState(null); // connection highlight (I hate this)
  const [hoveredConnection, setHoveredConnection] = useState(null); // highlights again
  const boardRef = useRef();

  // Ref to keep bounding rects for all notes
  const noteBoundsRef = useRef({});

  // Callback to set bounding rect for a note
  const handleNoteRef = (id, el) => {
    if (el) {
      noteBoundsRef.current[id] = el.getBoundingClientRect();
    } else {
      delete noteBoundsRef.current[id];
    }
  };

  // Add new note unless a connection just finished or is in progress
  const handleAddNote = (e) => {
    if (e.target !== boardRef.current) return;

    if (connecting || connectLine) return; // prevent adding while dragging connection

    if (connectionJustFinished) {
      setConnectionJustFinished(false); // consume event
      return;
    }

    // Check if we're coming from a resize operation
    if (e.target.closest('[data-resize-handle]')) {
      return; // Don't add note if click came from resize handle
    }

    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setNotes([
      ...notes,
      {
        id: uuid(),
        x: x - 75,
        y: y - 30,
        text: "",
        width: 210,
        height: 170,
        images: [], // Changed to array for multiple images
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      },
    ]);
  };

  // Drag note by updating position
  const handleDrag = (id, dx, dy) => {
    setNotes((prevNotes) =>
      prevNotes.map((n) =>
        n.id === id ? { ...n, x: n.x + dx, y: n.y + dy } : n
      )
    );
  };

  // Resize note by updating dimensions
  const handleResize = (id, newWidth, newHeight) => {
    setNotes((prevNotes) =>
      prevNotes.map((n) =>
        n.id === id ? { ...n, width: newWidth, height: newHeight } : n
      )
    );
  };

  // Check if mouse is near any note's connection circle
  const findNearbyNote = (mouseX, mouseY, excludeId) => {
    const PROXIMITY_THRESHOLD = 30; // pixels
    const boardRect = boardRef.current.getBoundingClientRect();
    
    // Convert mouse position to board coordinates
    const mouseBoardX = mouseX - boardRect.left;
    const mouseBoardY = mouseY - boardRect.top;
    
    for (const note of notes) {
      if (note.id === excludeId) continue;
      
      // Calculate circle center position using current note position
      const circleX = note.x + (note.width || 150) - 25; // Adjust for new circle position based on width
      const circleY = note.y + 15;  // Top area where circle is positioned
      
      const distance = Math.sqrt(
        Math.pow(mouseBoardX - circleX, 2) + Math.pow(mouseBoardY - circleY, 2)
      );
      
      console.log(`Checking note ${note.id}: mouse(${mouseBoardX}, ${mouseBoardY}) vs circle(${circleX}, ${circleY}) = distance ${distance}`);
      
      if (distance <= PROXIMITY_THRESHOLD) {
        console.log(`Found nearby note: ${note.id}`);
        return note.id;
      }
    }
    return null;
  };

  // Start connection drag from a circle on note
  const handleStartConnect = (note, circleDom, e) => {
    const boardRect = boardRef.current.getBoundingClientRect();
    const circleRect = circleDom.getBoundingClientRect();
    const start = {
      x: circleRect.left - boardRect.left + circleRect.width / 2,
      y: circleRect.top - boardRect.top + circleRect.height / 2,
    };
    setConnecting(note.id);
    connectingRef.current = note.id;
    setConnectLine({ fromPin: start, to: start });

    const onMove = (evt) => {
      const mouseX = evt.clientX;
      const mouseY = evt.clientY;
      
      setConnectLine((line) => ({
        ...line,
        to: { x: mouseX - boardRect.left, y: mouseY - boardRect.top },
      }));

      // Check for nearby notes
      const nearby = findNearbyNote(mouseX, mouseY, connectingRef.current);
      setNearbyNote(nearby);
    };

    const onUp = (evt) => {
      const fromId = connectingRef.current;
      
      // Mouse position in viewport
      const mouseX = evt.clientX;
      const mouseY = evt.clientY;

      // Check for nearby connection target
      const connectedNoteId = findNearbyNote(mouseX, mouseY, fromId);
      
      console.log('Connection attempt:', { fromId, connectedNoteId, mouseX, mouseY });

      if (connectedNoteId && fromId && fromId !== connectedNoteId) {
        // Avoid duplicates (either direction)
        const exists = connections.some(
          (c) =>
            (c.from === fromId && c.to === connectedNoteId) || 
            (c.from === connectedNoteId && c.to === fromId)
        );
        if (!exists) {
          const newConnection = { from: fromId, to: connectedNoteId, id: uuid() };
          setConnections(prev => [...prev, newConnection]);
          console.log('Connection created:', newConnection);
        } else {
          console.log('Connection already exists');
        }
      }

      // Clean up
      setConnectLine(null);
      setConnecting(null);
      setNearbyNote(null);
      connectingRef.current = null;
      setConnectionJustFinished(true);

      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Complete connection between circles
  const handleEndConnect = (id) => {
    const fromId = connectingRef.current;
    if (fromId && fromId !== id) {
      // Avoid duplicates (either direction)
      const exists = connections.some(
        (c) =>
          (c.from === fromId && c.to === id) || (c.from === id && c.to === fromId)
      );
      if (!exists) {
        const newConnection = { from: fromId, to: id, id: uuid() };
        setConnections([...connections, newConnection]);
      }
    }
  };

  // Delete a specific connection
  const handleDeleteConnection = (connectionId) => {
    setConnections(connections.filter((c) => c.id !== connectionId));
  };

  // Delete note and its related connections
  const handleDelete = (id) => {
    setNotes(notes.filter((n) => n.id !== id));
    setConnections(connections.filter((c) => c.from !== id && c.to !== id));
    // Also clean bounding rects for deleted notes
    delete noteBoundsRef.current[id];
  };

  // Render lines connecting notes with arrows
  const renderConnections = () =>
    connections.map((link) => {
      const from = notes.find((n) => n.id === link.from);
      const to = notes.find((n) => n.id === link.to);
      if (!from || !to) return null;
      const startX = from.x + (from.width || 150) - 25; // Adjust for circle position based on width
      const startY = from.y + 15;
      const endX = to.x + (to.width || 150) - 25;
      const endY = to.y + 15;
      
      const isHovered = hoveredConnection === link.id;
      
      return (
        <g key={link.id}>
          {/* Invisible thick line for easier mouse interaction */}
          <line
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke="transparent"
            strokeWidth={12}
            style={{ cursor: "pointer", pointerEvents: "all" }}
            onMouseEnter={() => setHoveredConnection(link.id)}
            onMouseLeave={() => setHoveredConnection(null)}
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteConnection(link.id);
            }}
          />
          {/* Visible line */}
          <line
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke={isHovered ? "#FF69B4" : "#FFB6C1"}
            strokeWidth={isHovered ? 4 : 3}
            markerEnd="url(#arrowhead)"
            style={{ pointerEvents: "none" }}
          />
        </g>
      );
    });

  // Export board state to JSON file
  const handleExport = () => {
    const boardState = {
      notes,
      connections,
      exportDate: new Date().toISOString(),
      version: "1.0"
    };
    
    const dataStr = JSON.stringify(boardState, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `cute-notes-board-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  // Import board state from JSON file
  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const boardState = JSON.parse(e.target.result);
        
        // Validate the imported data structure
        if (boardState.notes && Array.isArray(boardState.notes) && 
            boardState.connections && Array.isArray(boardState.connections)) {
          setNotes(boardState.notes);
          setConnections(boardState.connections);
          
          // Clear any ongoing operations
          setConnecting(null);
          setConnectLine(null);
          setNearbyNote(null);
          setHoveredConnection(null);
          connectingRef.current = null;
          
          console.log('Board imported successfully');
        } else {
          alert('Invalid board file format. Please select a valid sticky notes board file.');
        }
      } catch (error) {
        console.error('Error importing board:', error);
        alert('Error reading board file. Please check the file format.');
      }
    };
    reader.readAsText(file);
    
    // Reset the file input so the same file can be imported again
    event.target.value = '';
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #FFE5F1 0%, #E5F3FF 25%, #F0E5FF 50%, #E5FFE5 75%, #FFF5E5 100%)",
      backgroundSize: "400% 400%",
      animation: "gradientShift 20s ease infinite",
      fontFamily: "'Comic Sans MS', cursive, sans-serif"
    }}>
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1); }
        }
        
        .floating-hearts::before {
          content: '💕';
          position: absolute;
          top: -20px;
          left: 50%;
          transform: translateX(-50%);
          animation: float 3s ease-in-out infinite;
          pointer-events: none;
          z-index: 1000;
        }
        
        .sparkles::after {
          content: '✨';
          position: absolute;
          top: -15px;
          right: -15px;
          animation: sparkle 2s ease-in-out infinite;
          pointer-events: none;
        }
      `}</style>

      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        padding: "20px 30px",
        background: "rgba(255, 255, 255, 0.9)",
        backdropFilter: "blur(10px)",
        borderBottom: "3px solid #FFB6C1",
        boxShadow: "0 4px 20px rgba(255, 182, 193, 0.3)"
      }}>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "10px"
        }}>
          <span style={{ fontSize: "20px" }}>✨</span>
        </div>
        
        <h2 style={{ 
          margin: 0, 
          textAlign: "center",
          color: "#FF69B4",
          fontSize: "28px",
          textShadow: "2px 2px 4px rgba(255, 182, 193, 0.5)",
          background: "linear-gradient(45deg, #FF69B4, #DDA0DD, #FFB6C1)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text"
        }}>
          Log your train of thought
        </h2>
        
        <div style={{ 
          display: "flex", 
          justifyContent: "flex-end", 
          gap: "15px",
          alignItems: "center"
        }}>
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            style={{ display: "none" }}
            id="import-file-input"
          />
          <button
            onClick={() => document.getElementById('import-file-input').click()}
            className="floating-hearts"
            style={{
              padding: "12px 20px",
              background: "linear-gradient(45deg, #FFB6C1, #DDA0DD)",
              color: "white",
              border: "none",
              borderRadius: "25px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 6px 20px rgba(255, 182, 193, 0.4)",
              transition: "all 0.3s ease",
              position: "relative"
            }}
            title="Import your notes"
            onMouseEnter={(e) => {
              e.target.style.transform = "scale(1.05)";
              e.target.style.boxShadow = "0 8px 25px rgba(255, 182, 193, 0.6)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "scale(1)";
              e.target.style.boxShadow = "0 6px 20px rgba(255, 182, 193, 0.4)";
            }}
          >
            📁 Import
          </button>
          <button
            onClick={handleExport}
            className="sparkles"
            style={{
              padding: "12px 20px",
              background: "linear-gradient(45deg, #98FB98, #87CEEB)",
              color: "white",
              border: "none",
              borderRadius: "25px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 6px 20px rgba(152, 251, 152, 0.4)",
              transition: "all 0.3s ease",
              position: "relative"
            }}
            title="Save your masterpiece!"
            onMouseEnter={(e) => {
              e.target.style.transform = "scale(1.05)";
              e.target.style.boxShadow = "0 8px 25px rgba(152, 251, 152, 0.6)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "scale(1)";
              e.target.style.boxShadow = "0 6px 20px rgba(152, 251, 152, 0.4)";
            }}
          >
            💾 Export
          </button>
          
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "8px"
          }}>
            <span style={{ fontSize: "20px" }}>💖</span>
          </div>
        </div>
      </div>
      
      <div
        ref={boardRef}
        onClick={handleAddNote}
        style={{
          position: "relative",
          width: "100vw",
          height: "calc(100vh - 100px)",
          background: "transparent",
          overflow: "hidden",
          userSelect: connecting ? "none" : "auto",
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(255, 182, 193, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(221, 160, 221, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, rgba(152, 251, 152, 0.3) 0%, transparent 50%)
          `,
          backgroundSize: "100% 100%"
        }}
      >


        <svg
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            overflow: "visible",
          }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="5"
              refY="5"
              orient="auto"
            >
              <path d="M0,0 L10,5 L0,10 Z" fill={hoveredConnection ? "#FF69B4" : "#FFB6C1"} />
            </marker>
          </defs>
          {renderConnections()}
        </svg>
        {connectLine && (
          <svg
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              overflow: "visible",
            }}
          >
            <line
              x1={connectLine.fromPin.x}
              y1={connectLine.fromPin.y}
              x2={connectLine.to.x}
              y2={connectLine.to.y}
              stroke="#FF69B4"
              strokeWidth={3}
              strokeDasharray="8,4"
              style={{
                filter: "drop-shadow(0 2px 4px rgba(255, 105, 180, 0.3))"
              }}
            />
          </svg>
        )}
        {notes.map((note) => (
          <StickyNote
            key={note.id}
            {...note}
            onDrag={handleDrag}
            onDelete={handleDelete}
            onTextChange={(val) =>
              setNotes(
                notes.map((n) => (n.id === note.id ? { ...n, text: val } : n))
              )
            }
            onImageAdd={(imageData) =>
              setNotes((prevNotes) =>
                prevNotes.map((n) => 
                  n.id === note.id 
                    ? { ...n, images: [...(n.images || []), imageData] } 
                    : n
                )
              )
            }
            onImageRemove={(imageIndex) =>
              setNotes((prevNotes) =>
                prevNotes.map((n) => 
                  n.id === note.id 
                    ? { ...n, images: (n.images || []).filter((_, i) => i !== imageIndex) } 
                    : n
                )
              )
            }
            onStartConnect={handleStartConnect}
            onResize={handleResize}
            setNoteRef={(el) => handleNoteRef(note.id, el)}
            isNearby={nearbyNote === note.id}
          />
        ))}
      </div>
      <div style={{ 
        textAlign: "center", 
        padding: "20px",
        background: "rgba(255, 255, 255, 0.8)",
        color: "#8B4B8B",
        fontSize: "16px",
        fontWeight: "500",
        borderTop: "2px solid #FFB6C1",
        backdropFilter: "blur(10px)"
      }}>
         Click anywhere to create a note! Drag notes around, connect them with the little circles, and make your ideas beautiful! 
        <br />
         Drag corners to resize, click 🟰 to add pictures, or paste images directly! Click connections to remove them 💕
      </div>
    </div>
  );
}

function StickyNote({
  id,
  x,
  y,
  text,
  color,
  onDrag,
  onDelete,
  onTextChange,
  onImageAdd,
  onImageRemove,
  onStartConnect,
  setNoteRef,
  isNearby,
  width = 150,
  height = 80,
  images = [],
  onResize,
}) {
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const divRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (divRef.current) {
      setNoteRef(divRef.current);
    }
    return () => {
      setNoteRef(null);
    };
  }, [setNoteRef]);

  // Handle image file selection
  const handleImageUpload = (file) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const imageData = e.target.result;
          onImageAdd(imageData);
          
          // Auto-resize note to accommodate new image if needed
          const aspectRatio = img.width / img.height;
          const maxImageWidth = Math.max(width - 20, 200); // Account for padding
          const newImageHeight = maxImageWidth / aspectRatio;
          
          // Calculate total height needed for all images plus text
          const totalImagesHeight = (images.length + 1) * (newImageHeight + 6); // +6 for gap
          const newNoteHeight = Math.max(height, totalImagesHeight + 120); // Add space for text and header
          const newNoteWidth = Math.max(width, 200); // Minimum width for images
          
          onResize(id, newNoteWidth, newNoteHeight);
          setShowDropdown(false);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle paste events for images
  useEffect(() => {
    const handlePaste = (e) => {
      if (!textareaRef.current || document.activeElement !== textareaRef.current) {
        return;
      }
      
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
            e.preventDefault();
            const file = items[i].getAsFile();
            if (file) {
              handleImageUpload(file);
            }
            break;
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [images]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showDropdown && divRef.current && !divRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  // Mouse event handlers for dragging
  const onMouseDown = (e) => {
    if (resizing || showDropdown) return; // Don't start dragging while resizing or dropdown is open
    setDragging(true);
    dragOffset.current = {
      x: e.clientX - x,
      y: e.clientY - y,
    };
    e.stopPropagation();
  };

  const onMouseMove = (e) => {
    if (!dragging || resizing) return;
    onDrag(id, e.movementX, e.movementY);
  };

  const onMouseUp = () => setDragging(false);

  useEffect(() => {
    if (dragging && !resizing) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      return () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
    }
  });

  // Connection drag handlers
  const handleCircleDrag = (e) => {
    if (resizing || showDropdown) return; // Don't start connecting while resizing or dropdown is open
    onStartConnect({ id, x, y, text, color, width, height, images }, e.currentTarget, e);
    e.stopPropagation();
    e.preventDefault();
  };

  // Resize handlers
  const handleResizeStart = (e) => {
    setResizing(true);
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = width;
    const startHeight = height;

    const handleResizeMove = (moveEvent) => {
      moveEvent.preventDefault();
      const newWidth = Math.max(100, startWidth + (moveEvent.clientX - startX));
      const newHeight = Math.max(60, startHeight + (moveEvent.clientY - startY));
      onResize(id, newWidth, newHeight);
    };

    const handleResizeEnd = (endEvent) => {
      setResizing(false);
      endEvent.stopPropagation();
      endEvent.preventDefault();
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeEnd);
    };

    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeEnd);
  };

  // Handle menu button click
  const handleMenuClick = (e) => {
    e.stopPropagation();
    setShowDropdown(!showDropdown);
  };

  // Handle file input change
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  return (
    <div
      ref={divRef}
      style={{
        position: "absolute",
        top: y,
        left: x,
        width: width,
        height: height,
        boxShadow: resizing ? "0 4px 15px rgba(255, 182, 193, 0.2)" : "0 8px 25px rgba(255, 182, 193, 0.4)",
        borderRadius: 20,
        background: resizing ? color : `linear-gradient(135deg, ${color}, ${color}dd)`,
        padding: 0,
        zIndex: dragging || resizing ? 10 : 1,
        userSelect: "none",
        border: isNearby ? "3px solid #FF69B4" : "2px solid rgba(255, 255, 255, 0.6)",
        transform: dragging ? "rotate(2deg) scale(1.02)" : "rotate(0deg) scale(1)",
        transition: (dragging || resizing) ? "none" : "all 0.3s ease",
        backdropFilter: resizing ? "none" : "blur(5px)",
        fontFamily: "'Comic Sans MS', cursive, sans-serif",
        display: "flex",
        flexDirection: "column"
      }}
      data-noteid={id}
    >
      <div
        style={{
          background: resizing ? "rgba(255,255,255,0.2)" : "linear-gradient(135deg, rgba(255,255,255,0.3), rgba(255,255,255,0.1))",
          cursor: "grab",
          padding: 8,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
          backdropFilter: resizing ? "none" : "blur(10px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.3)"
        }}
        onMouseDown={onMouseDown}
      >
        <button
          onClick={handleMenuClick}
          style={{
            background: "linear-gradient(45deg, #FFB6C1, #DDA0DD)",
            border: "none",
            borderRadius: "50%",
            width: "28px",
            height: "28px",
            cursor: "pointer",
            userSelect: "none",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            boxShadow: "0 3px 10px rgba(255, 182, 193, 0.4)",
            transition: "all 0.2s ease"
          }}
          aria-label="Menu"
          title="Add images! 💕"
          onMouseEnter={(e) => {
            e.target.style.transform = "scale(1.1)";
            e.target.style.boxShadow = "0 4px 15px rgba(255, 182, 193, 0.6)";
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = "scale(1)";
            e.target.style.boxShadow = "0 3px 10px rgba(255, 182, 193, 0.4)";
          }}
        >
          📷
        </button>
        
        {/* Dropdown Menu */}
        {showDropdown && (
          <div
            style={{
              position: "absolute",
              top: "-10px",
              left: 0,
              background: "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,245,245,0.95))",
              border: "2px solid #FFB6C1",
              borderRadius: 15,
              boxShadow: "0 8px 25px rgba(255, 182, 193, 0.3)",
              zIndex: 3000,
              minWidth: 140,
              padding: 8,
              backdropFilter: "blur(10px)",
              transform: "translateY(-100%)"
            }}
          >
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100%",
                padding: "10px 15px",
                border: "none",
                background: "linear-gradient(45deg, #FFE5F1, #F0E5FF)",
                textAlign: "left",
                cursor: "pointer",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: "bold",
                color: "#8B4B8B",
                marginBottom: 4,
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.target.style.background = "linear-gradient(45deg, #FFB6C1, #DDA0DD)";
                e.target.style.color = "white";
                e.target.style.transform = "scale(1.02)";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "linear-gradient(45deg, #FFE5F1, #F0E5FF)";
                e.target.style.color = "#8B4B8B";
                e.target.style.transform = "scale(1)";
              }}
            >
              📎 Add Image
            </button>
            {images && images.length > 0 && (
              <button
                onClick={() => {
                  // Remove all images
                  for (let i = images.length - 1; i >= 0; i--) {
                    onImageRemove(i);
                  }
                  setShowDropdown(false);
                }}
                style={{
                  width: "100%",
                  padding: "10px 15px",
                  border: "none",
                  background: "linear-gradient(45deg, #FFE5E5, #FFF0F0)",
                  textAlign: "left",
                  cursor: "pointer",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: "bold",
                  color: "#D8527A",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "linear-gradient(45deg, #FF69B4, #FFB6C1)";
                  e.target.style.color = "white";
                  e.target.style.transform = "scale(1.02)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "linear-gradient(45deg, #FFE5E5, #FFF0F0)";
                  e.target.style.color = "#D8527A";
                  e.target.style.transform = "scale(1)";
                }}
              >
                🗑️ Clear Images
              </button>
            )}
          </div>
        )}
        
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Connection Circle */}
          <div
            onMouseDown={handleCircleDrag}
            data-noteid={id}
            title="Connect to another note! 💕"
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: isNearby 
                ? "linear-gradient(45deg, #FF69B4, #FFB6C1)" 
                : "linear-gradient(45deg, #DDA0DD, #FFB6C1)",
              cursor: "pointer",
              userSelect: "none",
              transition: "all 0.3s ease",
              border: "2px solid white",
              boxShadow: isNearby 
                ? "0 0 15px #FF69B4, 0 3px 10px rgba(255, 105, 180, 0.4)" 
                : "0 3px 10px rgba(221, 160, 221, 0.4)",
              transform: isNearby ? "scale(1.3)" : "scale(1)"
            }}
          />
          
          <button
            onClick={() => onDelete(id)}
            style={{
              background: "linear-gradient(45deg, #FFB6C1, #FF69B4)",
              border: "none",
              borderRadius: "50%",
              width: "24px",
              height: "24px",
              fontSize: 16,
              color: "white",
              cursor: "pointer",
              userSelect: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 3px 10px rgba(255, 105, 180, 0.4)",
              transition: "all 0.2s ease"
            }}
            aria-label="Delete note"
            title="Remove this note 💔"
            onMouseEnter={(e) => {
              e.target.style.transform = "scale(1.1)";
              e.target.style.boxShadow = "0 4px 15px rgba(255, 105, 180, 0.6)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "scale(1)";
              e.target.style.boxShadow = "0 3px 10px rgba(255, 105, 180, 0.4)";
            }}
          >
            ×
          </button>
        </div>
      </div>
      
      {/* Content Area */}
      <div style={{ 
        padding: "12px 15px", 
        display: "flex", 
        flexDirection: "column", 
        gap: "8px",
        flex: 1,
        overflow: "hidden"
      }}>
        {/* Images Display */}
        {images && images.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {images.map((imageData, index) => (
              <div key={index} style={{ position: "relative", textAlign: "center", overflow: "hidden" }}>
                <img
                  src={imageData}
                  alt={`image ${index + 1}`}
                  style={{
                    width: "100%",
                    height: "auto",
                    borderRadius: 12,
                    objectFit: "contain",
                    border: "2px solid rgba(255, 255, 255, 0.6)",
                    maxWidth: width - 30, // Account for padding
                    display: "block",
                    boxShadow: "0 4px 15px rgba(255, 182, 193, 0.3)"
                  }}
                />
                {/* Individual image delete button */}
                <button
                  onClick={() => onImageRemove(index)}
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    background: "linear-gradient(45deg, #FFB6C1, #FF69B4)",
                    border: "none",
                    borderRadius: "50%",
                    width: 24,
                    height: 24,
                    fontSize: 14,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    boxShadow: "0 3px 10px rgba(255, 105, 180, 0.5)",
                    transition: "all 0.2s ease"
                  }}
                  title="Remove this image 💔"
                  onMouseEnter={(e) => {
                    e.target.style.transform = "scale(1.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = "scale(1)";
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* Text Area */}
        <textarea
          ref={textareaRef}
          style={{
            background: "rgba(255, 255, 255, 0.3)",
            border: "2px solid rgba(255, 255, 255, 0.4)",
            borderRadius: 12,
            resize: "none",
            width: "100%",
            height: images && images.length > 0 ? 50 : Math.max(50, height - 70),
            fontSize: 16,
            outline: "none",
            fontFamily: "'Comic Sans MS', cursive, sans-serif",
            padding: "10px",
            color: "#8B4B8B",
            fontWeight: "500",
            backdropFilter: "blur(5px)",
            transition: resizing ? "none" : "all 0.2s ease",
            boxSizing: "border-box"
          }}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={images && images.length > 0 ? "Add a caption... " : "Your thoughts here... "}
          onFocus={(e) => {
            e.target.style.borderColor = "#FF69B4";
            e.target.style.boxShadow = "0 0 10px rgba(255, 105, 180, 0.3)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "rgba(255, 255, 255, 0.4)";
            e.target.style.boxShadow = "none";
          }}
        />
      </div>
      
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      
      {/* Resize handle */}
      <div
        data-resize-handle="true"
        onMouseDown={handleResizeStart}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: 20,
          height: 20,
          cursor: "nw-resize",
          background: "linear-gradient(135deg, #FFB6C1, #FF69B4)",
          borderTopLeftRadius: 12,
          borderBottomRightRadius: 18,
          userSelect: "none",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 3px 10px rgba(255, 105, 180, 0.4)",
          transition: "all 0.2s ease"
        }}
        title="Resize the note! 📏"
        onMouseEnter={(e) => {
          e.target.style.transform = "scale(1.1)";
          e.target.style.boxShadow = "0 4px 15px rgba(255, 105, 180, 0.6)";
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = "scale(1)";
          e.target.style.boxShadow = "0 3px 10px rgba(255, 105, 180, 0.4)";
        }}
      >
        <div style={{
          fontSize: "10px",
          color: "white"
        }}>⟲</div>
      </div>
    </div>
  );
}