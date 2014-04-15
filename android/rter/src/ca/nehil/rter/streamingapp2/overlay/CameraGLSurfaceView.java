package ca.nehil.rter.streamingapp2.overlay;

import ca.nehil.rter.streamingapp2.POIList;
import android.content.Context;
import android.graphics.PixelFormat;
import android.opengl.GLSurfaceView;

public class CameraGLSurfaceView extends GLSurfaceView {
	protected CameraGLRenderer camGLRenderer;
	
	public CameraGLSurfaceView(Context context, POIList POIs) {
		super(context);
		
		//needed to overlay gl view over camera preview
		this.setZOrderMediaOverlay(true);
		
        // Create an OpenGL ES 1.0 context
        this.setEGLContextClientVersion(1);
        this.getHolder().setFormat(PixelFormat.TRANSLUCENT);
        this.setEGLConfigChooser(8, 8, 8, 8, 16, 0);
        
        // Set the Renderer for drawing on the GLSurfaceView
        this.camGLRenderer = new CameraGLRenderer(context, POIs);
        this.setRenderer(camGLRenderer);
           
        // Render the view only when there is a change in the drawing data
        this.setRenderMode(GLSurfaceView.RENDERMODE_CONTINUOUSLY);
	}

	public CameraGLRenderer getGLRenderer() {
		return this.camGLRenderer;
	}
	
}
